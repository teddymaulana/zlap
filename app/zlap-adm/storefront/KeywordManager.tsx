"use client";

import { useState, useTransition } from "react";
import { addPopularKeyword, removePopularKeyword } from "@/app/actions/products";
import type { PopularKeyword } from "@/lib/types";

export default function KeywordManager({ keywords }: { keywords: PopularKeyword[] }) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {keywords.map((k) => (
          <span
            key={k.id}
            className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
          >
            {k.keyword}
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => removePopularKeyword(k.id))}
              aria-label={`Remove ${k.keyword}`}
              className="text-gray-500 hover:text-black disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        {keywords.length === 0 && <span className="text-sm text-gray-400">No keywords yet</span>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          startTransition(() => addPopularKeyword(value));
          setValue("");
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a keyword…"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
