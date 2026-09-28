"use client";

import { useState, useTransition } from "react";
import { updateProduct, uploadProductImage } from "@/app/actions/products";
import TagPicker from "@/app/zlap-adm/products/TagPicker";
import BrandSetPicker from "@/app/zlap-adm/products/BrandSetPicker";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { CardSet, Product } from "@/lib/types";
import { normalizeSnkrdunkUrl, snkrdunkSearchUrl } from "@/lib/snkrdunk";
import SnkrdunkPsa10 from "./SnkrdunkPsa10";
import PreorderSettings from "./PreorderSettings";

export default function ProductHeaderForm({
  product,
  allTags,
  sets,
  poOpenCount,
}: {
  product: Product;
  allTags: string[];
  sets: CardSet[];
  poOpenCount: number;
}) {
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [snkrdunkUrl, setSnkrdunkUrl] = useState(product.snkrdunk_url ?? "");
  const [snkrdunkError, setSnkrdunkError] = useState<string | null>(null);
  // Only a real link opens directly — a bare product number is only turned
  // into a URL on save (normalizeSnkrdunkUrl), so until then search instead.
  const snkrdunkLink = /^https?:\/\//i.test(snkrdunkUrl.trim()) ? snkrdunkUrl.trim() : null;

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
        // onSubmit, not action={...}: React resets a form after its action
        // runs, which snaps controlled fields (the pre-order checkbox,
        // markup, open limit) back to their page-load values on screen while
        // their state keeps the saved ones — so the form showed stale values
        // and a second Save would have sent them.
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          // Checked here too, not just in updateProduct — a server action's
          // thrown message is hidden in production, and there's no admin
          // error page to catch it, so a bad link would just break the page.
          try {
            normalizeSnkrdunkUrl(snkrdunkUrl);
          } catch (err) {
            setSnkrdunkError((err as Error).message);
            return;
          }
          setSnkrdunkError(null);
          startSaveTransition(() => updateProduct(product.id, fd));
        }}
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
        <div className="flex flex-col gap-1 rounded border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="storefront_enabled"
              defaultChecked={product.storefront_enabled}
              className="h-4 w-4"
            />
            Show this product on the storefront
          </label>
          <p className="text-xs text-gray-500">
            Uncheck to fully hide this product from storefront search, featured sections, related
            products, wishlist, and its own product page — regardless of stock.
          </p>
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
        <div className="flex flex-col gap-1 rounded border p-3">
          <label htmlFor="restock_eta_date" className="text-sm font-medium">
            Estimated restock date (optional)
          </label>
          <input
            id="restock_eta_date"
            name="restock_eta_date"
            type="date"
            defaultValue={product.restock_eta_date ?? ""}
            className="w-fit rounded border px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">
            Shown to customers as &ldquo;Back in stock around {"{date}"}&rdquo; while this product is out
            of stock.
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded border p-3">
          <label htmlFor="snkrdunk_url" className="text-sm font-medium">
            SNKRDUNK link (optional)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="snkrdunk_url"
              name="snkrdunk_url"
              type="text"
              value={snkrdunkUrl}
              onChange={(e) => setSnkrdunkUrl(e.target.value)}
              placeholder="https://snkrdunk.com/apparels/724996/used"
              className="min-w-0 flex-1 rounded border px-3 py-2 text-sm"
            />
            <a
              href={snkrdunkLink ?? snkrdunkSearchUrl(product.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50"
            >
              {snkrdunkLink ? "Check on SNKRDUNK ↗" : "Search on SNKRDUNK ↗"}
            </a>
          </div>
          {snkrdunkError && <p className="text-xs text-red-600">{snkrdunkError}</p>}
          <p className="text-xs text-gray-500">
            Staff-only reference for the Japanese market price — never shown to customers. Paste the
            card&rsquo;s SNKRDUNK link or just its number (e.g. 724996); without one, the button searches
            SNKRDUNK for this product&rsquo;s name.
          </p>
          <SnkrdunkPsa10 productId={product.id} hasSavedLink={Boolean(product.snkrdunk_url)} />
        </div>
        <PreorderSettings product={product} openCount={poOpenCount} />
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
