"use client";

import Link from "next/link";
import type { StorefrontProduct } from "@/app/actions/storefront";
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

  return (
    <div className="group flex h-full flex-col rounded border border-gray-200 px-3 pt-3 transition-colors hover:border-gray-400">
      <div className="relative mb-2">
        <Link href={`/store/products/${product.id}`}>
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
        {product.preorder && (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {copy.product.preorder}
          </span>
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
        href={`/store/products/${product.id}`}
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
      </div>
    </div>
  );
}
