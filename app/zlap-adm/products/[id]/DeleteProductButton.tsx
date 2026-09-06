"use client";

import { useTransition } from "react";
import { deleteProduct } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete product "${productName}"? This cannot be undone.`)) {
          startTransition(() => deleteProduct(productId));
        }
      }}
      className="relative rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      <span className={isPending ? "invisible" : ""}>Delete product</span>
      {isPending && <ButtonSpinner className="h-3 w-3" />}
    </button>
  );
}
