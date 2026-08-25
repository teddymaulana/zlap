"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { getStorefrontAvailability } from "@/app/actions/storefront";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, totalCount, totalPrice } = useCart();
  const [availability, setAvailability] = useState<Record<string, number>>({});

  const itemIds = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!itemIds) return;
    getStorefrontAvailability(itemIds.split(",")).then((rows) => {
      setAvailability(Object.fromEntries(rows.map((r) => [r.productId, r.available])));
    });
  }, [itemIds]);

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-label="Shopping cart"
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-xl transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Cart ({totalCount})</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="text-xl text-gray-500 hover:text-black"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">Your cart is empty.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-14 w-14 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border bg-gray-50 text-[9px] text-gray-400">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500 tabular-nums">
                      {item.price !== null ? formatMoney(item.price) : "Price unavailable"}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="rounded border px-2 text-sm hover:bg-gray-50"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        disabled={
                          typeof availability[item.id] === "number" &&
                          item.qty >= availability[item.id]
                        }
                        className="rounded border px-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        +
                      </button>
                    </div>
                    {typeof availability[item.id] === "number" &&
                      item.qty >= availability[item.id] && (
                        <div className="mt-0.5 text-xs text-red-600">
                          Only {availability[item.id]} in stock
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {item.price !== null ? formatMoney(item.price * item.qty) : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t px-4 py-3">
            <div className="text-xs text-gray-500">
              {totalCount} item{totalCount === 1 ? "" : "s"}
            </div>
            <div className="mt-1 flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
            <Link
              href="/store/checkout"
              onClick={closeCart}
              className="mt-3 block w-full rounded bg-black px-4 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
