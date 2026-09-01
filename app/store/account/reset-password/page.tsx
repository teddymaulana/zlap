"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordWithToken(token, password);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/store/account");
        router.refresh();
      }
    });
  };

  if (!token) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-12">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="text-sm text-red-600">This reset link is missing or invalid.</p>
        <Link href="/store/account/forgot-password" className="text-sm text-black underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          required
          minLength={8}
          className="rounded border px-3 py-2 text-sm"
        />
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            {error.includes("expired") && (
              <Link href="/store/account/forgot-password" className="underline">
                Request a new link
              </Link>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="relative rounded bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Reset password</span>
          {isPending && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
