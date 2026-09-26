"use client";

import { useState, useTransition } from "react";
import { updateOrderCustomer } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";
import { formatStatus } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderCustomer({ order }: { order: Order }) {
  const [name, setName] = useState(order.customer_name ?? "");
  const [email, setEmail] = useState(order.customer_email ?? "");
  const [phone, setPhone] = useState(order.customer_phone ?? "");
  const [address, setAddress] = useState(order.customer_address ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty =
    name !== (order.customer_name ?? "") ||
    email !== (order.customer_email ?? "") ||
    phone !== (order.customer_phone ?? "") ||
    address !== (order.customer_address ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateOrderCustomer(order.id, { name, email, phone, address });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save customer");
      }
    });
  };

  return (
    <div className="mb-6 rounded border p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">Customer</span>
        <span className="flex items-center gap-2">
          {order.status === "cancelled" && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Cancelled</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              order.payment_status === "paid"
                ? "bg-green-100 text-green-800"
                : order.payment_status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : order.payment_status === "refund_pending" || order.payment_status === "refunded"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            {formatStatus(order.payment_status)}
            {order.payment_method ? ` · ${order.payment_method}` : ""}
          </span>
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name"
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Customer email"
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer phone"
          className="rounded border px-2 py-1 text-sm"
        />
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shipping address"
          rows={3}
          className="rounded border px-2 py-1 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || !isDirty}
            className="relative rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <span className={isPending ? "invisible" : ""}>Save customer</span>
            {isPending && <ButtonSpinner className="h-3 w-3" />}
          </button>
          {saved && !isDirty && <span className="text-xs text-gray-500">Saved</span>}
        </div>
      </form>
    </div>
  );
}
