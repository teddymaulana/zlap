"use client";

import { useState } from "react";
import { submitStockNotification } from "@/app/actions/storefront";
import { copy } from "@/lib/copy";

export default function NotifyMeModal({ productId, onClose }: { productId: string; onClose: () => void }) {
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
