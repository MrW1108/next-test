"use client";
import { ReactNode, useState } from "react";
import { getMessageReactNode } from "./action";
import { WithIncreaseFontSize } from "./client-button";

export default function Chat2() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ReactNode[]>([]);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    const message = { role: "user", content: inputValue } as const;
    const newNode = await getMessageReactNode(message);

    setMessages((prev) => [...prev, newNode]);
    setInputValue("");
  };

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Type a message..."
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>

      <WithIncreaseFontSize>
        <div>Hello</div>
      </WithIncreaseFontSize>
    </div>
  );
}
