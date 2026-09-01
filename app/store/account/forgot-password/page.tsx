"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email);
      setSubmitted(true);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      {submitted ? (
        <p className="text-sm text-gray-600">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to
          reset your password. It expires in an hour.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">
            Enter the email on your account and we&apos;ll send you a reset link.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="relative rounded bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isPending ? "invisible" : ""}>Send reset link</span>
            {isPending && <ButtonSpinner />}
          </button>
        </form>
      )}
      <p className="text-sm text-gray-500">
        <Link href="/store/account/login" className="text-black underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
