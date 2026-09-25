"use client";

import { useState, useTransition } from "react";
import { updatePaymentGateway } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { PaymentGateway } from "@/lib/types";

const OPTIONS: { value: PaymentGateway; label: string; description: string }[] = [
  { value: "midtrans", label: "Midtrans", description: "VA, QRIS, GoPay, ShopeePay, retail codes" },
  { value: "doku", label: "DOKU", description: "Hosted checkout page — customer picks the channel there" },
];

// Switches which gateway chargeExistingOrder (app/actions/checkout.ts)
// charges new checkouts through — takes effect immediately, no separate
// save step, since this isn't copy but a live routing decision.
export default function PaymentGatewayToggle({ value }: { value: PaymentGateway }) {
  const [gateway, setGateway] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const select = (next: PaymentGateway) => {
    if (next === gateway || isPending) return;
    setError(null);
    const previous = gateway;
    setGateway(next);
    startTransition(async () => {
      try {
        await updatePaymentGateway(next);
      } catch (err) {
        setGateway(previous);
        setError(err instanceof Error ? err.message : "Failed to switch gateway");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => select(opt.value)}
            aria-pressed={gateway === opt.value}
            className={`relative min-w-[220px] rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-50 ${
              gateway === opt.value ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className={isPending && gateway === opt.value ? "invisible" : ""}>
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-gray-500">{opt.description}</span>
            </span>
            {isPending && gateway === opt.value && <ButtonSpinner className="h-3 w-3" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        New checkouts are charged through whichever gateway is selected here — switching takes effect immediately.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
