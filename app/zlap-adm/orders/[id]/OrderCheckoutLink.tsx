"use client";

import { useState, useTransition } from "react";
import { generateOrderCheckoutLink } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { Order } from "@/lib/types";

const SITE_URL = "https://zlapcard.com";

export default function OrderCheckoutLink({ order, lineCount }: { order: Order; lineCount: number }) {
  const [name, setName] = useState(order.customer_name ?? "");
  const [email, setEmail] = useState(order.customer_email ?? "");
  const [phone, setPhone] = useState(order.customer_phone ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (order.payment_status === "paid") {
    return (
      <div className="mb-6 rounded border p-4 text-sm text-gray-600">
        This order has been paid — no checkout link needed.
      </div>
    );
  }

  const isPayable = order.payment_status === "unpaid" || order.payment_status === "failed" || order.payment_status === "expired";
  const isTokenLive =
    isPayable && order.checkout_token && (!order.token_expires_at || new Date(order.token_expires_at) > new Date());
  const link = isTokenLive ? `${SITE_URL}/pay/${order.checkout_token}` : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        await generateOrderCheckoutLink(order.id, { name, email, phone });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate checkout link");
      }
    });
  };

  return (
    <div className="mb-6 rounded border p-4 text-sm">
      <div className="mb-3 font-medium">Checkout link</div>
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
          required
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer phone"
          className="rounded border px-2 py-1 text-sm"
        />
        {lineCount === 0 && (
          <p className="text-xs text-gray-500">Add at least one line item before generating a checkout link.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending || lineCount === 0}
          className="relative self-start rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>
            {order.checkout_token ? "Regenerate & send checkout link" : "Generate & send checkout link"}
          </span>
          {isPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
      </form>

      {link && (
        <div className="mt-3 flex items-center gap-2 rounded bg-gray-50 p-2">
          <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{link}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
            }}
            className="shrink-0 rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      {isTokenLive && order.token_expires_at && (
        <p className="mt-2 text-xs text-gray-500">
          Expires {new Date(order.token_expires_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
