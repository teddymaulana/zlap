"use client";

import { useState, useTransition } from "react";
import { updateOrderAwb } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { Order } from "@/lib/types";

export default function OrderAwb({ order }: { order: Order }) {
  const [value, setValue] = useState(order.awb ?? "");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => updateOrderAwb(order.id, value));
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="awb" className="text-sm text-gray-500">
        AWB (J&T)
      </label>
      <input
        id="awb"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter resi number"
        className="rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="relative rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Save</span>
        {isPending && <ButtonSpinner className="h-3 w-3" />}
      </button>
    </form>
  );
}
