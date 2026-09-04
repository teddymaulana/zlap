"use client";

import { useState } from "react";
import Link from "next/link";
import { submitStockNotification, type StorefrontProduct } from "@/app/actions/storefront";
import { isSlabProduct } from "@/lib/productCategory";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { copy, fillCopy } from "@/lib/copy";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function preorderText(preorder: StorefrontProduct["preorder"]) {
  if (!preorder) return null;
  if (preorder.date) {
    const date = new Date(preorder.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return fillCopy(copy.product.arrivesOn, { date });
  }
  return fillCopy(copy.product.shipsInDays, { days: preorder.days ?? 30 });
}

export default function ProductCard({ product }: { product: StorefrontProduct }) {
  const { addItem } = useCart();
  const { productIds, toggle } = useWishlist();
  const isWishlisted = productIds.has(product.id);
  const showSetName = product.setName && isSlabProduct(product);
  // undefined (every listing besides search) is treated as in stock — only
  // search populates this field (see StorefrontProduct in storefront.ts).
  const inStock = product.inStock !== false;
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

  return (
    <div
      className={`group flex h-full cursor-pointer flex-col rounded border px-3 pt-3 transition-colors ${
        inStock ? "border-gray-200 hover:border-gray-400" : "border-red-300"
      }`}
    >
      <div className="relative mb-2">
        <Link href={`/products/${product.id}`}>
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full rounded object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded bg-gray-50 text-xs text-gray-400">
              {copy.common.noImage}
            </div>
          )}
        </Link>
        {!inStock ? (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Out of Stock
          </span>
        ) : (
          product.preorder && (
            <span className="absolute right-1.5 bottom-1.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {copy.product.preorder}
            </span>
          )
        )}
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={isWishlisted ? copy.common.removeFromWishlist : copy.common.addToWishlist}
          className={`absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow transition-opacity hover:bg-white ${
            isWishlisted ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isWishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            className={`h-4 w-4 ${isWishlisted ? "text-red-500" : "text-gray-500"}`}
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>
      <Link
        href={`/products/${product.id}`}
        className="text-sm font-medium text-[#151515] hover:underline"
      >
        {product.name}
      </Link>
      {showSetName && <div className="text-xs text-gray-500">{product.setName}</div>}
      {product.preorder && (
        <div className="text-xs text-blue-700">{preorderText(product.preorder)}</div>
      )}
      <div className="mt-auto pt-2">
        <div className="text-sm font-semibold text-[#151515] tabular-nums">
          {product.price !== null ? formatMoney(product.price) : copy.common.priceUnavailable}
        </div>
        {inStock ? (
          <button
            type="button"
            onClick={() => addItem(product)}
            className="mt-2 flex w-full items-center justify-between border-t border-gray-200 py-2 text-xs font-medium text-gray-900 transition-colors group-hover:border-gray-400 hover:bg-gray-50"
          >
            {copy.common.addToCart}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsNotifyOpen(true)}
            className="mt-2 flex w-full items-center justify-center border-t border-red-200 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Notify me
          </button>
        )}
      </div>
      {isNotifyOpen && (
        <NotifyMeModal productId={product.id} onClose={() => setIsNotifyOpen(false)} />
      )}
    </div>
  );
}

function NotifyMeModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await submitStockNotification(productId, { email, phone });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <div
        role="dialog"
        aria-label="Notify me when back in stock"
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-lg bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Notify me when back in stock</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.common.close}
            className="text-xl text-gray-500 hover:text-black"
          >
            ×
          </button>
        </div>
        {submitted ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">We&rsquo;ll let you know when it&rsquo;s back!</p>
            <button
              type="button"
              onClick={onClose}
              className="self-start rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">Enter at least one — email or phone.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="relative mt-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting…" : "Notify me"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
