"use client";

import { useTransition } from "react";
import { updateOrderDate } from "@/app/actions/orders";
import type { Order } from "@/lib/types";

export default function OrderDate({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="date"
      value={order.date ? order.date.slice(0, 10) : ""}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateOrderDate(order.id, e.target.value))}
      className="rounded border px-2 py-1 text-sm disabled:opacity-50"
    />
  );
}
