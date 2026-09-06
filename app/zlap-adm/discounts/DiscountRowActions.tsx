"use client";

import { useTransition } from "react";
import { toggleDiscountActive, deleteDiscount } from "@/app/actions/discounts";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function DiscountRowActions({
  discountId,
  discountName,
  isActive,
}: {
  discountId: string;
  discountName: string;
  isActive: boolean;
}) {
  const [isTogglePending, startToggleTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const isPending = isTogglePending || isDeletePending;

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startToggleTransition(() => toggleDiscountActive(discountId, isActive))}
        className="relative rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isTogglePending ? "invisible" : ""}>{isActive ? "Deactivate" : "Activate"}</span>
        {isTogglePending && <ButtonSpinner className="h-3 w-3" />}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm(`Delete discount "${discountName}"? This cannot be undone.`)) {
            startDeleteTransition(() => deleteDiscount(discountId));
          }
        }}
        className="relative rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <span className={isDeletePending ? "invisible" : ""}>Delete</span>
        {isDeletePending && <ButtonSpinner className="h-3 w-3" />}
      </button>
    </div>
  );
}
