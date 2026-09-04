"use client";

import { useState, useTransition } from "react";
import { addCardSet, removeCardSet } from "@/app/actions/sets";
import { PRODUCT_BRANDS, CARD_SET_LANGUAGES } from "@/lib/constants";
import type { CardSet } from "@/lib/types";

export default function SetManager({ sets }: { sets: CardSet[] }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<"pokemon" | "one_piece">("pokemon");
  const [language, setLanguage] = useState<"en" | "jp" | "id">("en");
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(() => addCardSet(name, brand, language));
          setName("");
        }}
        className="mb-8 flex flex-wrap items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Set name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Obsidian Flames"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Brand</label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value as "pokemon" | "one_piece")}
            className="rounded border px-3 py-2 text-sm"
          >
            {PRODUCT_BRANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "jp" | "id")}
            className="rounded border px-3 py-2 text-sm"
          >
            {CARD_SET_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Add set
        </button>
      </form>

      {PRODUCT_BRANDS.map((b) => {
        const brandSets = sets.filter((s) => s.brand === b.value);
        if (brandSets.length === 0) return null;

        return (
          <div key={b.value} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">{b.label}</h2>
            {CARD_SET_LANGUAGES.map((l) => {
              const langSets = brandSets.filter((s) => s.language === l.value);
              if (langSets.length === 0) return null;
              return (
                <div key={l.value} className="mb-3">
                  <h3 className="mb-1 text-xs font-medium text-gray-500">{l.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {langSets.map((s) => (
                      <span
                        key={s.id}
                        className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                      >
                        {s.name}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => startTransition(() => removeCardSet(s.id))}
                          aria-label={`Remove ${s.name}`}
                          className="text-gray-500 hover:text-black disabled:opacity-50"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
