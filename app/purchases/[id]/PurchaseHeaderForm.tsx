"use client";

import { useTransition } from "react";
import { updatePurchaseHeader } from "@/app/actions/purchases";
import type { Purchase } from "@/lib/types";

const FEE_FIELDS: { key: keyof Purchase; label: string }[] = [
  { key: "inter_shipping", label: "Intl shipping" },
  { key: "forwarding", label: "Forwarding" },
  { key: "local_cargo", label: "Local cargo" },
  { key: "payment_fee", label: "Payment fee" },
  { key: "other_expense", label: "Other expense" },
  { key: "deduction", label: "Deduction" },
];

export default function PurchaseHeaderForm({ purchase }: { purchase: Purchase }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(() => updatePurchaseHeader(purchase.id, fd))}
      className="mb-6 flex flex-col gap-3 rounded border p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            defaultValue={purchase.name ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            name="date"
            type="date"
            defaultValue={purchase.date ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        {FEE_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            {label}
            <input
              name={key}
              type="number"
              min={0}
              defaultValue={purchase[key] as number}
              className="rounded border px-2 py-1"
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
