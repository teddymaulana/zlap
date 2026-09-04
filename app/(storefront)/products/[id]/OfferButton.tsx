"use client";

import { useEffect, useState } from "react";
import { submitOffer } from "@/app/actions/offers";
import { getCurrentCustomer } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";
import { copy, fillCopy } from "@/lib/copy";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function OfferButton({
  productId,
  productName,
  currentPrice,
}: {
  productId: string;
  productName: string;
  currentPrice: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setEmail((prev) => prev || customer.email || "");
    });
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const offeredPrice = Number(price);
    if (!offeredPrice || offeredPrice <= 0) {
      setError(copy.product.invalidOfferPrice);
      return;
    }
    if (offeredPrice >= currentPrice) {
      setError(copy.product.offerTooHigh);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await submitOffer({ productId, offeredPrice, qty, name, email });
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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded border border-black px-4 py-3 text-sm font-medium hover:bg-gray-50"
      >
        {copy.product.makeOffer}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-lg bg-white p-5 sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="text-center">
                <div className="mb-2 text-lg font-semibold">{copy.product.offerSent}</div>
                <p className="mb-4 text-sm text-gray-600">
                  {copy.product.offerEmailPrefix} <span className="font-medium">{email}</span>{" "}
                  {copy.product.offerEmailSuffix}
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded bg-black px-4 py-2 text-sm text-white"
                >
                  {copy.common.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold">{copy.product.makeOffer}</h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={copy.common.close}
                    className="text-gray-400 hover:text-black"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {fillCopy(copy.product.currentPriceLine, {
                    name: productName,
                    price: formatMoney(currentPrice),
                  })}
                </p>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={copy.product.yourOfferPlaceholder}
                  required
                  className="rounded border px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <label htmlFor="offer-qty" className="text-sm text-gray-600">
                    {copy.common.qty}
                  </label>
                  <input
                    id="offer-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded border px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={copy.product.yourNamePlaceholder}
                  required
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.common.email}
                  required
                  className="rounded border px-3 py-2 text-sm"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative rounded bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <span className={isSubmitting ? "invisible" : ""}>{copy.product.sendOffer}</span>
                  {isSubmitting && <ButtonSpinner />}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
