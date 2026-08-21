"use client";

import { useState } from "react";
import { PRODUCT_TAGS } from "@/lib/constants";

export default function TagPicker({
  name = "tags",
  initialTags = [],
}: {
  name?: string;
  initialTags?: string[];
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [search, setSearch] = useState("");

  const suggestions = PRODUCT_TAGS.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(search.toLowerCase())
  );

  function addTag(t: string) {
    setTags((prev) => [...prev, t]);
    setSearch("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="text-gray-500 hover:text-black"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
            <input type="hidden" name={name} value={t} />
          </span>
        ))}
        {tags.length === 0 && <span className="text-sm text-gray-400">No tags</span>}
      </div>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tag to add…"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {search && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
            {suggestions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
