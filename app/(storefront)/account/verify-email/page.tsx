"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmailWithToken } from "@/app/actions/customer";
import PageSpinner from "@/app/PageSpinner";

export default function VerifyEmailPage() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "success" | "error">(token ? "pending" : "error");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verifyEmailWithToken(token).then((result) => {
      if (result.error) {
        setError(result.error);
        setStatus("error");
      } else {
        setStatus("success");
      }
    });
  }, [token]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Verify your email</h1>
      {status === "pending" && <PageSpinner />}
      {status === "success" && (
        <>
          <p className="text-sm text-green-700">Your email is verified.</p>
          <Link href="/account" className="text-sm text-black underline">
            Go to your account
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-sm text-red-600">
            {error ?? "This verification link is missing or invalid."}
          </p>
          <Link href="/account" className="text-sm text-black underline">
            Go to your account
          </Link>
        </>
      )}
    </div>
  );
}
