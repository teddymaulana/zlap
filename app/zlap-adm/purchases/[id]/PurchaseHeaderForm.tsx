"use client";

import { useTransition } from "react";
import { updatePurchaseHeader } from "@/app/actions/purchases";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { Purchase } from "@/lib/types";

const FEE_FIELDS: { key: keyof Purchase; label: string }[] = [
  { key: "inter_shipping", label: "Intl shipping" },
  { key: "forwarding", label: "Forwarding" },
  { key: "local_cargo", label: "Local cargo" },
  { key: "payment_fee", label: "Payment fee" },
  { key: "other_expense", label: "Other expense" },
  { key: "deduction", label: "Deduction" },
];

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

export default function PurchaseHeaderForm({
  purchase,
  totalQty,
  totalItemCost,
  totalFees,
  grandTotal,
}: {
  purchase: Purchase;
  totalQty: number;
  totalItemCost: number;
  totalFees: number;
  grandTotal: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(() => updatePurchaseHeader(purchase.id, fd))}
      className="mb-6 flex flex-col gap-3 rounded border p-4"
    >
      <div className="grid grid-cols-2 gap-3 border-b pb-3 text-center sm:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-gray-500">Total products</div>
          <div className="text-2xl font-bold">{totalQty}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Total product prices</div>
          <div className="text-2xl font-bold">{formatMoney(totalItemCost)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Total fees</div>
          <div className="text-2xl font-bold">{formatMoney(totalFees)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Total</div>
          <div className="text-2xl font-bold">{formatMoney(grandTotal)}</div>
        </div>
      </div>
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
        className="relative self-start rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Save</span>
        {isPending && <ButtonSpinner />}
      </button>
    </form>
  );
}
