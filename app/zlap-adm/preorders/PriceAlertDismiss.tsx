"use client";

import { useTransition } from "react";
import { dismissPoPriceAlert } from "@/app/actions/snkrdunk";

export default function PriceAlertDismiss({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => void (await dismissPoPriceAlert(productId)))}
      className="ml-auto rounded border border-orange-300 bg-white px-2 py-0.5 text-xs hover:bg-orange-100 disabled:opacity-50"
    >
      Dismiss
    </button>
  );
}
