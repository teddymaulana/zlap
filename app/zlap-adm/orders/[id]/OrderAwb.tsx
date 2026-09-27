"use client";

import { useState, useTransition } from "react";
import { updateOrderAwb } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";
import { COURIERS, type Courier } from "@/lib/couriers";
import type { Order } from "@/lib/types";

// One of the order's shipments: its in-stock items ("stock", awb/courier)
// or its pre-order items ("preorder", po_awb/po_courier).
export default function OrderAwb({ order, shipment = "stock" }: { order: Order; shipment?: "stock" | "preorder" }) {
  const isPreorder = shipment === "preorder";
  const [value, setValue] = useState((isPreorder ? order.po_awb : order.awb) ?? "");
  const [courier, setCourier] = useState<Courier>(isPreorder ? order.po_courier : order.courier);
  const [isPending, startTransition] = useTransition();
  const inputId = isPreorder ? "po_awb" : "awb";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => updateOrderAwb(order.id, value, courier, shipment));
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor={inputId} className="text-sm text-gray-500">
        {isPreorder ? "Pre-order AWB" : "AWB"}
      </label>
      <select
        aria-label="Courier"
        value={courier}
        onChange={(e) => setCourier(e.target.value as Courier)}
        className="rounded border px-2 py-1 text-sm"
      >
        {(Object.keys(COURIERS) as Courier[]).map((code) => (
          <option key={code} value={code}>
            {COURIERS[code]}
          </option>
        ))}
      </select>
      <input
        id={inputId}
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
