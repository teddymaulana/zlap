"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "@/app/actions/orders";
import type { Order } from "@/lib/types";

export default function OrderStatus({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={order.status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(() =>
          updateOrderStatus(order.id, e.target.value as "pending" | "completed")
        )
      }
      className="rounded border px-2 py-1 text-sm"
    >
      <option value="pending">Pending</option>
      <option value="completed">Fulfilled</option>
    </select>
  );
}
