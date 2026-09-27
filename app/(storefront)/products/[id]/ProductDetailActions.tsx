"use client";

import { useState } from "react";
import type { StorefrontProductDetail } from "@/app/actions/storefront";
import { preorderCartId, preorderMaxQty, useCart } from "../../CartContext";
import { useWishlist } from "../../WishlistContext";
import NotifyMeModal from "../../NotifyMeModal";
import { copy, fillCopy } from "@/lib/copy";
import { PO_ESTIMATE_WEEKS } from "@/lib/preorder";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function ProductDetailActions({ product }: { product: StorefrontProductDetail }) {
  const { addItem } = useCart();
  const { productIds, toggle } = useWishlist();
  const isWishlisted = productIds.has(product.id);
  // undefined (every listing besides search/PDP) is treated as in stock — see
  // StorefrontProduct.inStock in storefront.ts.
  const inStock = product.inStock !== false && product.price !== null;
  const canPreorder = product.poPrice !== null;
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  // Which way to buy when both are offered — in stock by default.
  const [choice, setChoice] = useState<"stock" | "preorder">("stock");
  const buyPreorder = canPreorder && (!inStock || choice === "preorder");

  const options = [
    { key: "stock", label: copy.product.inStockOption, price: product.price, note: copy.product.inStockOptionNote },
    {
      key: "preorder",
      label: copy.product.preorderOption,
      price: product.poPrice,
      note: fillCopy(copy.product.preorderOptionNote, PO_ESTIMATE_WEEKS),
    },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      {inStock && canPreorder && (
        <div role="radiogroup" aria-label="How to buy" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const selected = choice === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(option.key)}
                className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                  selected ? "border-black ring-1 ring-black" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-base font-semibold tabular-nums">{formatMoney(option.price!)}</div>
                <div className="text-xs text-gray-500">{option.note}</div>
              </button>
            );
          })}
        </div>
      )}
      {buyPreorder && <p className="text-xs text-gray-500">{copy.product.preorderFullPayment}</p>}

      <div className="flex gap-2">
        {buyPreorder ? (
          <button
            type="button"
            onClick={() =>
              addItem({
                ...product,
                id: preorderCartId(product.id),
                productId: product.id,
                isPreorder: true,
                poMaxQty: preorderMaxQty(product.poSlotsLeft),
                price: product.poPrice,
                originalPrice: null,
              })
            }
            className="flex-1 rounded bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            {copy.product.preorderNow}
          </button>
        ) : inStock ? (
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
        {isNotifyOpen && <NotifyMeModal productId={product.id} onClose={() => setIsNotifyOpen(false)} />}
      </div>
    </div>
  );
}
