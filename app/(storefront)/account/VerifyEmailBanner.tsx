"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/app/actions/customer";

export default function VerifyEmailBanner() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const resend = async () => {
    setStatus("sending");
    const result = await resendVerificationEmail();
    setStatus(result.error ? "error" : "sent");
  };

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-2 rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm">
      <span className="text-yellow-800">
        {status === "sent"
          ? "Verification email sent — check your inbox."
          : "Please verify your email address."}
      </span>
      {status !== "sent" && (
        <button
          type="button"
          onClick={resend}
          disabled={status === "sending"}
          className="font-medium text-yellow-900 underline hover:no-underline disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : status === "error" ? "Failed — try again" : "Resend email"}
        </button>
      )}
    </div>
  );
}
