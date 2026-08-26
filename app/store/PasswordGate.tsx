"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockStorefront } from "@/app/actions/storefront";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function PasswordGate() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await unlockStorefront(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-xl font-semibold">Zlap Store</h1>
      <p className="text-sm text-gray-500">This storefront is still in development.</p>
      <form action={submit} className="flex flex-col gap-4">
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="relative rounded bg-black px-3 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Enter</span>
          {isPending && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
