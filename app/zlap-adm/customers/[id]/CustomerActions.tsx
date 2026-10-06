"use client";

import { useState, useTransition } from "react";
import {
  setCustomerEmailVerified,
  sendCustomerPasswordReset,
  signOutCustomerEverywhere,
  deleteCustomer,
} from "@/app/actions/adminCustomers";
import ButtonSpinner from "@/app/ButtonSpinner";

type Action = "verify" | "reset" | "signout" | "delete";

export default function CustomerActions({
  customerId,
  customerLabel,
  emailVerified,
  activeSessionCount,
}: {
  customerId: string;
  customerLabel: string;
  emailVerified: boolean;
  activeSessionCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const run = (which: Action, action: () => Promise<string | void>) => {
    setPendingAction(which);
    setMessage(null);
    startTransition(async () => {
      try {
        const text = await action();
        if (text) setMessage({ error: false, text });
      } catch (e) {
        setMessage({ error: true, text: e instanceof Error ? e.message : "Something went wrong" });
      }
    });
  };

  const button = (which: Action, label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      disabled={isPending}
      onClick={onClick}
      className={`relative rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${
        danger ? "border-red-300 text-red-700 hover:bg-red-50" : "hover:bg-gray-50"
      }`}
    >
      <span className={isPending && pendingAction === which ? "invisible" : ""}>{label}</span>
      {isPending && pendingAction === which && <ButtonSpinner className="h-3 w-3" />}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {button("verify", emailVerified ? "Mark email unverified" : "Mark email verified", () =>
          run("verify", () => setCustomerEmailVerified(customerId, !emailVerified))
        )}
        {button("reset", "Send password reset email", () =>
          run("reset", async () => {
            const { error } = await sendCustomerPasswordReset(customerId);
            if (error) throw new Error(error);
            return "Password reset email sent";
          })
        )}
        {button("signout", `Sign out everywhere (${activeSessionCount} active)`, () =>
          run("signout", async () => {
            await signOutCustomerEverywhere(customerId);
            return "Signed out of all sessions";
          })
        )}
        {button(
          "delete",
          "Delete account",
          () => {
            if (
              confirm(
                `Delete ${customerLabel}'s account? Their orders are kept but unlinked. This cannot be undone.`
              )
            ) {
              run("delete", () => deleteCustomer(customerId));
            }
          },
          true
        )}
      </div>
      {message && (
        <div className={`mt-2 text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</div>
      )}
    </div>
  );
}
