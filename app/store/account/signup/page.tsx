"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpCustomer } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await signUpCustomer(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/store/account");
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <form action={submit} className="flex flex-col gap-3">
        <input
          type="text"
          name="name"
          placeholder="Full name"
          required
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          placeholder="Password (min. 8 characters)"
          required
          minLength={8}
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone number (optional)"
          className="rounded border px-3 py-2 text-sm"
        />
        <textarea
          name="address"
          placeholder="Address (optional)"
          rows={2}
          className="rounded border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="relative rounded bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Create account</span>
          {isPending && <ButtonSpinner />}
        </button>
      </form>
      <p className="text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/store/account/login" className="text-black underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
