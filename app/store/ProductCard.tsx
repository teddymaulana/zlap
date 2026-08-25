"use client";

import Link from "next/link";
import type { StorefrontProduct } from "@/app/actions/storefront";
import { isSlabProduct } from "@/lib/productCategory";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function preorderText(preorder: StorefrontProduct["preorder"]) {
  if (!preorder) return null;
  if (preorder.date) {
    return `Arrives ${new Date(preorder.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`;
  }
  return `Ships in ~${preorder.days ?? 30} days`;
}

export default function ProductCard({ product }: { product: StorefrontProduct }) {
  const { addItem } = useCart();
  const { productIds, toggle } = useWishlist();
  const isWishlisted = productIds.has(product.id);
  const showSetName = product.setName && isSlabProduct(product);

  return (
    <div className="group flex h-full flex-col rounded border p-3">
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
              No image
            </div>
          )}
        </Link>
        {product.preorder && (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Pre-order
          </span>
        )}
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
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
      <Link href={`/store/products/${product.id}`} className="text-sm font-medium hover:underline">
        {product.name}
      </Link>
      {showSetName && <div className="text-xs text-gray-500">{product.setName}</div>}
      {product.preorder && (
        <div className="text-xs text-blue-700">{preorderText(product.preorder)}</div>
      )}
      <div className="mt-auto pt-2">
        <div className="text-sm font-semibold tabular-nums">
          {product.price !== null ? formatMoney(product.price) : "Price unavailable"}
        </div>
        <button
          type="button"
          onClick={() => addItem(product)}
          className="mt-2 w-full rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
