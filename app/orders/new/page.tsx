"use client";

import { useState, useTransition } from "react";
import { createOrder } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function NewOrderPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createOrder(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">New order</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="order_id" className="text-sm font-medium">
            Order ID
          </label>
          <input id="order_id" name="order_id" required className="rounded border px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="channel" className="text-sm font-medium">
            Channel
          </label>
          <select id="channel" name="channel" className="rounded border px-3 py-2">
            <option value="">—</option>
            <option value="tokopedia">Tokopedia</option>
            <option value="shopee">Shopee</option>
            <option value="website">Website</option>
            <option value="direct">Direct</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="order_url" className="text-sm font-medium">
            Order URL
          </label>
          <input id="order_url" name="order_url" className="rounded border px-3 py-2" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="relative rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Create</span>
          {isPending && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
