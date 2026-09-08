"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { getStorefrontAvailability } from "@/app/actions/storefront";
import { isGradedOrSingleProduct } from "@/lib/productCategory";
import { CARD_SET_LANGUAGES } from "@/lib/constants";
import { copy, fillCopy } from "@/lib/copy";

function setLanguageLabel(item: { tags: string[]; name: string; setLanguage?: "en" | "jp" | "id" | null }) {
  if (!item.setLanguage || !isGradedOrSingleProduct(item)) return null;
  return CARD_SET_LANGUAGES.find((l) => l.value === item.setLanguage)?.label ?? null;
}

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQty,
    totalCount,
    totalPrice,
    appliedCode,
    appliedDiscount,
    codePriceByProduct,
    cartDiscountAmount,
    applyDiscountCode,
    removeDiscountCode,
  } = useCart();
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isApplyingCode, setIsApplyingCode] = useState(false);

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return;
    setCodeError(null);
    setIsApplyingCode(true);
    try {
      const result = await applyDiscountCode(codeInput);
      if (result.error) setCodeError(result.error);
      else setCodeInput("");
    } finally {
      setIsApplyingCode(false);
    }
  };

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
        aria-label={copy.cart.dialogAria}
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-xl transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            {copy.cart.title} ({totalCount})
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label={copy.cart.closeAria}
            className="text-xl text-gray-500 hover:text-black"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">{copy.cart.empty}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => {
                const trueBasePrice = item.originalPrice ?? item.price ?? 0;
                const effectivePrice = codePriceByProduct.get(item.id) ?? item.price ?? 0;
                const isDiscounted = !item.isGift && trueBasePrice > effectivePrice;
                return (
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
                      {copy.common.noImage}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    {setLanguageLabel(item) && (
                      <div className="text-xs text-gray-500">{setLanguageLabel(item)}</div>
                    )}
                    {item.isGift ? (
                      <div className="mt-0.5 text-xs font-medium text-green-600">Free gift</div>
                    ) : (
                      <div className="mt-0.5 text-xs text-gray-500 tabular-nums">
                        {item.originalPrice
                          ? formatMoney(item.originalPrice)
                          : item.price !== null
                            ? formatMoney(item.price)
                            : copy.common.priceUnavailable}
                      </div>
                    )}
                    {item.isGift ? (
                      <div className="mt-1 text-sm text-gray-500">Qty {item.qty}</div>
                    ) : (
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
                    )}
                    {!item.isGift &&
                      typeof availability[item.id] === "number" &&
                      item.qty >= availability[item.id] && (
                        <div className="mt-0.5 text-xs text-red-600">
                          {fillCopy(copy.cart.onlyNInStock, { n: availability[item.id] })}
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.isGift ? (
                      <span className="flex flex-col items-end">
                        {item.originalPrice ? (
                          <span className="text-xs text-gray-400 line-through tabular-nums">
                            {formatMoney(item.originalPrice * item.qty)}
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold text-green-600 uppercase">Free</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-end">
                        {isDiscounted ? (
                          <>
                            <span className="flex items-center gap-0.5 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-red-600">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3 w-3"
                              >
                                <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                <circle cx="7" cy="7" r="1" />
                              </svg>
                              -{Math.round(((trueBasePrice - effectivePrice) / trueBasePrice) * 100)}%
                            </span>
                            <span className="text-xs text-gray-400 line-through tabular-nums">
                              {formatMoney(trueBasePrice * item.qty)}
                            </span>
                          </>
                        ) : null}
                        <span
                          className={`text-sm font-semibold tabular-nums ${isDiscounted ? "text-green-600" : ""}`}
                        >
                          {item.price !== null ? formatMoney(effectivePrice * item.qty) : "—"}
                        </span>
                      </span>
                    )}
                    {!item.isGift && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={copy.cart.removeAria}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                          <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t px-4 py-3">
            {appliedDiscount ? (
              <div className="mb-2 flex items-center justify-between rounded bg-green-50 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-green-700">
                  Code <span className="font-mono uppercase">{appliedCode}</span> applied
                </span>
                <button
                  type="button"
                  onClick={removeDiscountCode}
                  className="text-green-700 underline hover:text-green-800"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="mb-2">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCode();
                      }
                    }}
                    placeholder="Discount code"
                    className="w-full rounded border px-2.5 py-1.5 text-xs uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCode}
                    disabled={isApplyingCode || !codeInput.trim()}
                    className="shrink-0 rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isApplyingCode ? "Applying…" : "Apply"}
                  </button>
                </div>
                {codeError && <p className="mt-1 text-xs text-red-600">{codeError}</p>}
              </div>
            )}
            <div className="text-xs text-gray-500">
              {totalCount} {copy.cart.item}
              {totalCount === 1 ? "" : "s"}
            </div>
            {cartDiscountAmount > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm text-green-600">
                <span>Savings</span>
                <span className="flex items-center gap-1 tabular-nums">
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
                    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <circle cx="7" cy="7" r="1" />
                  </svg>
                  -{formatMoney(cartDiscountAmount)}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-base font-semibold">
              <span>{copy.common.total}</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="mt-3 block w-full rounded bg-black px-4 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              {copy.cart.checkout}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
