"use client";

import { useState, useTransition } from "react";
import { updateCheckoutOpen } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";

const OPTIONS: { value: boolean; label: string; description: string }[] = [
  { value: false, label: "Closed", description: "Customers see “Checkout coming soon” — admin can still test" },
  { value: true, label: "Open", description: "Anyone can place orders from their cart" },
];

// Gates cart checkout for customers (canPlaceOrders in
// app/actions/checkout.ts) — takes effect immediately, same as the gateway
// switch, since it's a live routing decision rather than copy.
export default function CheckoutOpenToggle({ value }: { value: boolean }) {
  const [open, setOpen] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const select = (next: boolean) => {
    if (next === open || isPending) return;
    if (next && !window.confirm("Open checkout to all customers? Orders will start coming in right away.")) return;
    setError(null);
    const previous = open;
    setOpen(next);
    startTransition(async () => {
      try {
        await updateCheckoutOpen(next);
      } catch (err) {
        setOpen(previous);
        setError(err instanceof Error ? err.message : "Failed to update checkout");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            disabled={isPending}
            onClick={() => select(opt.value)}
            aria-pressed={open === opt.value}
            className={`relative min-w-[220px] rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-50 ${
              open === opt.value ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className={isPending && open === opt.value ? "invisible" : ""}>
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-gray-500">{opt.description}</span>
            </span>
            {isPending && open === opt.value && <ButtonSpinner className="h-3 w-3" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Order lookups and admin-issued pay, offer and request links keep working either way.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
