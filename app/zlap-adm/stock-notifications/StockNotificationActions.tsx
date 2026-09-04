"use client";

import { useState, useTransition } from "react";
import { markStockNotificationNotified, deleteStockNotification } from "@/app/actions/adminStockNotifications";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function StockNotificationActions({
  id,
  notified,
}: {
  id: string;
  notified: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"notify" | "delete" | null>(null);

  const run = (action: (id: string) => Promise<void>, which: "notify" | "delete") => {
    setPendingAction(which);
    startTransition(() => action(id));
  };

  return (
    <div className="flex gap-2">
      {!notified && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(markStockNotificationNotified, "notify")}
          className="relative rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending && pendingAction === "notify" ? "invisible" : ""}>Mark notified</span>
          {isPending && pendingAction === "notify" && <ButtonSpinner className="h-3 w-3" />}
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(deleteStockNotification, "delete")}
        className="relative rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isPending && pendingAction === "delete" ? "invisible" : ""}>Delete</span>
        {isPending && pendingAction === "delete" && <ButtonSpinner className="h-3 w-3" />}
      </button>
    </div>
  );
}
