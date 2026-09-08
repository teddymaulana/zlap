"use client";

import { useState } from "react";
import type { StorefrontProductDetail } from "@/app/actions/storefront";
import { useCart } from "../../CartContext";
import { useWishlist } from "../../WishlistContext";
import NotifyMeModal from "../../NotifyMeModal";
import { copy } from "@/lib/copy";

export default function ProductDetailActions({ product }: { product: StorefrontProductDetail }) {
  const { addItem } = useCart();
  const { productIds, toggle } = useWishlist();
  const isWishlisted = productIds.has(product.id);
  // undefined (every listing besides search/PDP) is treated as in stock — see
  // StorefrontProduct.inStock in storefront.ts.
  const inStock = product.inStock !== false;
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

  return (
    <div className="flex gap-2">
      {inStock ? (
        <button
          type="button"
          onClick={() => addItem(product)}
          className="flex-1 rounded bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          {copy.common.addToCart}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsNotifyOpen(true)}
          className="flex-1 rounded border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Notify me
        </button>
      )}
      <button
        type="button"
        onClick={() => toggle(product.id)}
        aria-label={isWishlisted ? copy.common.removeFromWishlist : copy.common.addToWishlist}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border hover:bg-gray-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isWishlisted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          className={`h-5 w-5 ${isWishlisted ? "text-red-500" : "text-gray-500"}`}
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      </button>
      {isNotifyOpen && (
        <NotifyMeModal productId={product.id} onClose={() => setIsNotifyOpen(false)} />
      )}
    </div>
  );
}
