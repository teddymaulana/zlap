"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { optOutOfCartReminders } from "@/app/actions/carts";
import ButtonSpinner from "@/app/ButtonSpinner";

// The abandoned-cart email's unsubscribe link. Asks for a click rather than
// unsubscribing on page load, so email link scanners can't trigger it.
export default function UnsubscribeCartRemindersPage() {
  const cartId = useSearchParams().get("c") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unsubscribe = () => {
    setError(null);
    startTransition(async () => {
      const result = await optOutOfCartReminders(cartId);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Cart reminder emails</h1>
      {done ? (
        <p className="text-sm text-gray-600">
          You&apos;re unsubscribed. We won&apos;t email you about items left in your cart again.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Stop getting emails when you leave items in your cart? Order and account emails aren&apos;t affected.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={unsubscribe}
            disabled={isPending}
            className="relative rounded bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isPending ? "invisible" : ""}>Unsubscribe</span>
            {isPending && <ButtonSpinner />}
          </button>
        </>
      )}
      <Link href="/" className="text-sm text-gray-500 underline">
        Back to the shop
      </Link>
    </div>
  );
}
