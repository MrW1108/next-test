import { z } from "zod";
import { listAllReminders } from "@/app/db/redis";
import { fuzzySearch } from "./fuzzy-search";
import { EditReminderDialog } from "./edit-reminder-dialog";

const paramsSchema = z.object({
  searchQuery: z
    .string()
    .describe("The search query to find the reminder to edit or delete"),
  action: z
    .enum(["edit", "delete"])
    .describe("The action to perform on the reminder"),
  newContent: z
    .string()
    .optional()
    .describe(
      "The new content for the reminder (required if action is 'edit')"
    ),
});

export type ParamsType = z.infer<typeof paramsSchema>;

export const specs = {
  description: "A tool to edit or delete a reminder by searching its content",
  parameters: paramsSchema,
};

export async function execute(
  args: ParamsType,
  saveToolCallResult: <T>(result: T) => void
) {
  try {
    const reminders = await listAllReminders();

    // Use our custom fuzzy search
    const searchResults = fuzzySearch(
      reminders,
      args.searchQuery,
      (reminder) => reminder.content
    );

    if (searchResults.length === 0) {
      throw new Error(`No reminders found matching "${args.searchQuery}"`);
    }

    // Get the best match
    const bestMatch = searchResults[0].item;

    // Validate that newContent is provided for edit action
    if (args.action === "edit" && !args.newContent) {
      throw new Error("New content is required when editing a reminder");
    }

    // Save the current state
    saveToolCallResult(
      "Tool call is NOT executed yet. Waiting for user to confirm on the dialog (do not ask if you want to proceed because User must perform on UI). You can just reply with 'waiting for user confirmation' if you don't need to say anything else. Do not reply with another tool_call."
    );

    // Return the confirmation dialog
    return (
      <EditReminderDialog
        reminder={bestMatch}
        allReminders={reminders}
        searchResults={searchResults}
        action={args.action}
        newContent={args.newContent}
      />
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to find reminder";
    saveToolCallResult({ error: errorMessage });
    return <div className="text-red-500">{errorMessage}</div>;
  }
}
