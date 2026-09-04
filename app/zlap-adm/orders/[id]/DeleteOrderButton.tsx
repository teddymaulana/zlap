"use client";

import { useTransition } from "react";
import { deleteOrder } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function DeleteOrderButton({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete order ${orderCode}? This cannot be undone.`)) {
          startTransition(() => deleteOrder(orderId));
        }
      }}
      className="relative rounded border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      <span className={isPending ? "invisible" : ""}>Delete order</span>
      {isPending && <ButtonSpinner className="h-3 w-3" />}
    </button>
  );
}
