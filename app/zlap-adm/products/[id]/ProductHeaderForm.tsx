"use client";

import { useTransition } from "react";
import { updateProduct, uploadProductImage } from "@/app/actions/products";
import TagPicker from "@/app/zlap-adm/products/TagPicker";
import BrandSetPicker from "@/app/zlap-adm/products/BrandSetPicker";
import ButtonSpinner from "@/app/ButtonSpinner";
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
          <button type="submit" disabled={isUploadPending} className="relative text-xs underline">
            <span className={isUploadPending ? "invisible" : ""}>Upload</span>
            {isUploadPending && <ButtonSpinner className="h-3 w-3" />}
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
        <div className="flex flex-col gap-2 rounded border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="offers_enabled"
              defaultChecked={product.offers_enabled}
              className="h-4 w-4"
            />
            Allow &ldquo;Make an offer&rdquo; on the storefront
          </label>
          <div className="flex flex-col gap-1">
            <label htmlFor="offer_min_price" className="text-xs text-gray-500">
              Minimum acceptable offer (staff-only reference, not shown to customers)
            </label>
            <input
              id="offer_min_price"
              name="offer_min_price"
              type="number"
              min="0"
              step="1"
              defaultValue={product.offer_min_price ?? ""}
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="show_when_oos"
              defaultChecked={product.show_when_oos}
              className="h-4 w-4"
            />
            Show on storefront search even when out of stock
          </label>
          <p className="text-xs text-gray-500">
            Shown at the end of search results, marked Out of Stock, with a &ldquo;Notify me&rdquo; option
            instead of Add to cart.
          </p>
        </div>
        <button
          type="submit"
          disabled={isSavePending}
          className="relative self-start rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          <span className={isSavePending ? "invisible" : ""}>Save</span>
          {isSavePending && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
