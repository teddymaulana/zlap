"use client";

import { useState } from "react";

type PickableProduct = { id: string; name: string; sku: string | null; image_url: string | null };

// Search-and-add product picker, backed by hidden inputs so it plugs into a
// plain <form action={serverAction}> without any client-side submit
// handling — same approach as ../products/TagPicker.tsx, but resolving to
// real products (with a thumbnail) instead of free-text tags.
export default function ProductPicker({
  name,
  products,
  initialIds = [],
  multiple = true,
}: {
  name: string;
  products: PickableProduct[];
  initialIds?: string[];
  multiple?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    multiple ? initialIds : initialIds.slice(0, 1)
  );
  const [search, setSearch] = useState("");

  const byId = new Map(products.map((p) => [p.id, p]));
  const selected = selectedIds.map((id) => byId.get(id)).filter((p): p is PickableProduct => Boolean(p));

  const query = search.trim().toLowerCase();
  const suggestions = query
    ? products
        .filter(
          (p) =>
            !selectedIds.includes(p.id) &&
            (p.name.toLowerCase().includes(query) || (p.sku ?? "").toLowerCase().includes(query))
        )
        .slice(0, 8)
    : [];

  function add(id: string) {
    setSelectedIds((prev) => (multiple ? [...prev, id] : [id]));
    setSearch("");
  }

  function remove(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {selected.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded border px-2 py-1.5">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="h-8 w-8 shrink-0 rounded border object-cover" />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded border bg-gray-50" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{p.name}</div>
              {p.sku && <div className="truncate text-xs text-gray-500">{p.sku}</div>}
            </div>
            <button
              type="button"
              onClick={() => remove(p.id)}
              className="text-gray-500 hover:text-black"
              aria-label={`Remove ${p.name}`}
            >
              ×
            </button>
            <input type="hidden" name={name} value={p.id} />
          </div>
        ))}
        {selected.length === 0 && <span className="text-sm text-gray-400">No products picked</span>}
      </div>
      {(multiple || selected.length === 0) && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-6 w-6 shrink-0 rounded border object-cover" />
                  ) : (
                    <div className="h-6 w-6 shrink-0 rounded border bg-gray-50" />
                  )}
                  <span className="truncate">{p.name}</span>
                  {p.sku && <span className="shrink-0 text-xs text-gray-400">{p.sku}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
