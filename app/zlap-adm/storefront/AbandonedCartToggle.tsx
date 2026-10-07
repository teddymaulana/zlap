"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateAbandonedCartEmails } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";

const OPTIONS: { value: boolean; label: string; description: string }[] = [
  { value: false, label: "Off", description: "No cart reminder emails are sent" },
  { value: true, label: "On", description: "Signed-in customers get one reminder the evening after leaving a cart" },
];

// Read by the daily abandoned-cart cron (app/api/cron/abandoned-carts), so
// it takes effect from the next run. Cart tracking for /zlap-adm/carts runs
// either way.
export default function AbandonedCartToggle({ value }: { value: boolean }) {
  const [enabled, setEnabled] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const select = (next: boolean) => {
    if (next === enabled || isPending) return;
    setError(null);
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await updateAbandonedCartEmails(next);
      } catch (err) {
        setEnabled(previous);
        setError(err instanceof Error ? err.message : "Failed to update abandoned cart emails");
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
            aria-pressed={enabled === opt.value}
            className={`relative min-w-[220px] rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-50 ${
              enabled === opt.value ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className={isPending && enabled === opt.value ? "invisible" : ""}>
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-gray-500">{opt.description}</span>
            </span>
            {isPending && enabled === opt.value && <ButtonSpinner className="h-3 w-3" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Sent daily at 19:00 WIB for carts left 12+ hours, at most once a week per customer.{" "}
        <Link href="/zlap-adm/carts" className="underline">
          See what&apos;s in carts
        </Link>
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
