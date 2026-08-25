"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutCustomer } from "@/app/actions/customer";

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await signOutCustomer();
          router.push("/store");
          router.refresh();
        })
      }
      className="text-sm text-gray-500 hover:underline disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
