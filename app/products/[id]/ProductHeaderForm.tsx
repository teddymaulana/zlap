"use client";

import { useTransition } from "react";
import { updateProduct, uploadProductImage } from "@/app/actions/products";
import TagPicker from "@/app/products/TagPicker";
import BrandSetPicker from "@/app/products/BrandSetPicker";
import type { CardSet, Product } from "@/lib/types";

export default function ProductHeaderForm({
  product,
  allTags,
  sets,
}: {
  product: Product;
  allTags: string[];
  sets: CardSet[];
}) {
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();

  return (
    <div className="mb-8 flex flex-col gap-6 sm:flex-row">
      <div className="flex flex-col items-start gap-2">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-32 w-32 rounded border object-cover"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded border bg-gray-50 text-xs text-gray-400">
            No image
          </div>
        )}
        <form
          action={(fd) => startUploadTransition(() => uploadProductImage(product.id, fd))}
          className="flex flex-col gap-1"
        >
          <input type="file" name="image" accept="image/*" className="text-xs" />
          <button type="submit" disabled={isUploadPending} className="text-xs underline">
            {isUploadPending ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>

      <form
        action={(fd) => startSaveTransition(() => updateProduct(product.id, fd))}
        className="flex flex-1 flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={product.name}
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sku" className="text-sm font-medium">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            defaultValue={product.sku ?? ""}
            className="rounded border px-3 py-2"
          />
        </div>
        <BrandSetPicker sets={sets} initialBrand={product.brand} initialSetId={product.set_id} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tags</span>
          <TagPicker initialTags={product.tags} allTags={allTags} />
        </div>
        <button
          type="submit"
          disabled={isSavePending}
          className="self-start rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isSavePending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
