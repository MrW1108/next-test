import { Suspense } from "react";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  experimental_generateImage as generateImage,
  generateObject,
} from "ai";

import { z } from "zod";

import { cacheLife } from "next/dist/server/use-cache/cache-life";
import Link from "next/link";
import { ErrorBoundary } from "./error-boundary";
import { Pronounce } from "./pronounce";

type ISearchParams = Promise<{
  query: string | undefined;
}>;

const DICT_HOME = "/dict";

export default function Search({
  searchParams,
}: {
  searchParams: ISearchParams;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-24 bg-gradient-to-b from-amber-50 to-white">
      <div className="w-full max-w-2xl px-2 sm:px-0">
        <h1 className="text-3xl sm:text-4xl font-serif text-gray-800 mb-6 sm:mb-8 text-center">
          <Link href={DICT_HOME}>𝒻𝒶𝓈𝓉 Dictionary</Link>
        </h1>
        <SearchBar />
        <Suspense>
          <SearchHeader searchParams={searchParams} />
        </Suspense>

        <ErrorBoundary
          fallback={<div>Something went wrong. Please try again.</div>}
        >
          <Suspense>
            <SearchContent searchParams={searchParams} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

// ************* Meta Data *************
export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: ISearchParams;
}) => {
  const { query } = await searchParams;
  return {
    title: query
      ? `${query?.slice(0, 30)}${
          query?.length > 30 ? "..." : ""
        } - 𝒻𝒶𝓈𝓉 Dictionary`
      : "𝒻𝒶𝓈𝓉 Dictionary",
    description: "Simple AI dictionary",
  };
};

// ************* Shared *************
const ELIPSIS = <p className="text-gray-600">...</p>;

// Safari buffers the first 1KB of content, so we need to add invisible characters to force it to flush the initial buffering
const SafariInitialBufferFix = () => {
  return <>{"\u200b".repeat(1024)}</>;
};

// ************* Search Bar *************
const SearchBar = () => {
  return (
    <form action={DICT_HOME} className="mb-4 sm:mb-6">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          name="query"
          placeholder="Look up a word/phrase..."
          className="flex-1 rounded-lg border border-gray-300 px-4 sm:px-6 py-2 sm:py-3 bg-white text-gray-800 placeholder-gray-500 shadow-sm transition-all duration-200 hover:border-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none font-serif text-base sm:text-lg"
        />
      </div>
    </form>
  );
};

const SearchHeader = async ({
  searchParams,
}: {
  searchParams: ISearchParams;
}) => {
  const { query } = await searchParams;
  if (!query) {
    return null;
  }
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-serif text-gray-800 line-clamp-1">
        {query}
      </h2>
      <Pronounce input={query} />
    </div>
  );
};

// ************* Search Content *************
const SearchContent = async ({
  searchParams,
}: {
  searchParams: ISearchParams;
}) => {
  const { query } = await searchParams;
  if (!query) {
    return null;
  }
  console.log("query", query);
  return (
    <div className="rounded-lg border border-gray-200 p-4 sm:p-6 bg-white shadow-md">
      <RenderSearch query={query} />
      <RenderImage query={query} />
    </div>
  );
};

const RenderSearch = async ({ query }: { query: string }) => {
  "use cache";
  cacheLife("max");

  const reader = await (
    await streamText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content: `Task: Translate input to Chinese and provide definitions for marked terms.
Format Rules:

Single Words:

Line 1: Chinese translation

Line 2: English definition (with Chinese translations for complex terms in brackets)

Sentences:

Line 1: Original sentence

Line 2: Chinese translation

Subsequent lines: For starred terms, list:
[English Term] ([Chinese]): [Definition]. [Hard word translations in brackets if needed]

Examples:

Input: dictionary
Output:
字典
A reference book listing words with meanings, pronunciations (发音), and usage.

Input: The further our cause* advances
Output:
The further our cause advances
我们的事业越向前推进
cause (事业): A goal or movement people support or work toward.

Input: not least in the European Union
Output:
not least in the European Union
在欧盟中尤其重要
not least (尤其重要): At least as significant as other factors.
          `,
        },
        {
          role: "user",
          content: query,
        },
      ],
    }).textStream
  ).getReader();

  return (
    <Suspense
      fallback={
        <>
          <SafariInitialBufferFix />
          {ELIPSIS}
        </>
      }
    >
      <RenderStream reader={reader} />
    </Suspense>
  );
};

const RenderStream = async ({
  reader,
}: {
  reader: ReadableStreamDefaultReader<string>;
}) => {
  const { done, value } = await reader.read();

  if (done) {
    return null;
  }

  return (
    <>
      <span className="text-gray-700 text-base sm:text-lg whitespace-pre-wrap font-serif leading-relaxed">
        {value}
      </span>
      <Suspense fallback={ELIPSIS}>
        <RenderStream reader={reader} />
      </Suspense>
    </>
  );
};

const MaybeGenerateImage = async ({ query }: { query: string }) => {
  "use cache";
  cacheLife("max");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      shouldGenerate: z.boolean(),
      optimizedPrompt: z.string().optional(),
    }),
    prompt: `Analyze "${query}". Should it be visualized? If yes, provide a concrete art prompt (MUST optimize the size of the input tokens to the image generationmodel). If no, just return false. Focus on visual elements, avoid abstract concepts. You can assume that the image model is bad at abstraction thinking.`,
  });

  if (!object.shouldGenerate || !object.optimizedPrompt) {
    return (
      <div>
        <p className="mt-4 inline-block bg-gray-50 text-gray-500">
          No image generated. This query is not suitable for an image.
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="w-full h-[100%] aspect-square bg-gray-100 flex flex-col gap-4 items-center justify-center mt-4">
          <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-gray-600" />
          <p className="text-gray-500 text-sm text-center px-4">
            {object.optimizedPrompt}
          </p>
        </div>
      }
    >
      <GenerateImage optimizedPrompt={object.optimizedPrompt} />
    </Suspense>
  );
};

const GenerateImage = async ({
  optimizedPrompt,
}: {
  optimizedPrompt: string;
}) => {
  const { image } = await generateImage({
    model: openai.image("dall-e-2"),
    prompt: optimizedPrompt,
    size: "512x512",
  });

  return (
    <img
      src={`data:image/png;base64,${image.base64}`}
      alt={optimizedPrompt}
      className="mt-4 w-full h-[100%] aspect-square"
    />
  );
};

const RenderImage = async ({ query }: { query: string }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="w-full h-[100%] aspect-square bg-gray-100 flex items-center justify-center mt-4">
          <div className="text-red-500">Failed to generate image.</div>
        </div>
      }
    >
      <Suspense>
        <MaybeGenerateImage query={query} />
      </Suspense>
    </ErrorBoundary>
  );
};
