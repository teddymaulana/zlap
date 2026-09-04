"use client";

import { useState, useTransition } from "react";
import { setProductFeatured } from "@/app/actions/products";

type Candidate = { id: string; name: string; sku: string | null };

export default function AddToSection({
  section,
  candidates,
}: {
  section: "featured_section_1" | "featured_section_2";
  candidates: Candidate[];
}) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const trimmed = search.trim().toLowerCase();
  const matches = trimmed
    ? candidates
        .filter(
          (p) =>
            p.name.toLowerCase().includes(trimmed) || (p.sku ?? "").toLowerCase().includes(trimmed)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products to add…"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      {search && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(() => setProductFeatured(p.id, section, true));
                setSearch("");
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <span>{p.name}</span>
              {p.sku && <span className="text-xs text-gray-400">{p.sku}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
