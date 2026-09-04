"use client";

import { useTransition } from "react";
import { reorderFeaturedProduct, setProductFeatured } from "@/app/actions/products";
import type { Product } from "@/lib/types";

export default function FeaturedOrderList({
  section,
  products,
}: {
  section: "featured_section_1" | "featured_section_2";
  products: Product[];
}) {
  const [isPending, startTransition] = useTransition();

  if (products.length === 0) {
    return <p className="mb-3 text-sm text-gray-500">No products selected yet.</p>;
  }

  return (
    <div className="mb-3">
      <div className="divide-y rounded border">
        {products.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-3">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-8 w-8 shrink-0 rounded border object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-gray-50 text-[8px] text-gray-400">
                  No image
                </div>
              )}
              <span className="text-sm">{p.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isPending || i === 0}
                onClick={() => startTransition(() => reorderFeaturedProduct(p.id, section, "up"))}
                aria-label="Move up"
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={isPending || i === products.length - 1}
                onClick={() => startTransition(() => reorderFeaturedProduct(p.id, section, "down"))}
                aria-label="Move down"
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => setProductFeatured(p.id, section, false))}
                className="ml-2 rounded border px-2 py-1 text-xs text-red-600 hover:bg-gray-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
