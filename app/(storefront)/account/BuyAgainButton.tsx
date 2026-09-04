"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getReorderItems } from "@/app/actions/customer";
import { useCart } from "../CartContext";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function BuyAgainButton({ orderId }: { orderId: string }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const handleClick = () => {
    setNotice(null);
    startTransition(async () => {
      const result = await getReorderItems(orderId);
      if (!result) {
        setNotice("Couldn't load this order.");
        return;
      }
      if (result.items.length === 0) {
        setNotice("None of the items from this order are available right now.");
        return;
      }
      for (const item of result.items) {
        const qty = result.qtyByProductId[item.productId] ?? 1;
        for (let i = 0; i < qty; i++) {
          addItem({ id: item.productId, name: item.name, sku: item.sku, image_url: item.imageUrl, price: item.price });
        }
      }
      if (result.unavailable.length > 0) {
        setNotice(`Added what's available. Couldn't add: ${result.unavailable.join(", ")}.`);
      } else {
        router.push("/checkout");
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="relative rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Buy again</span>
        {isPending && <ButtonSpinner />}
      </button>
      {notice && <p className="mt-2 text-xs text-gray-500">{notice}</p>}
    </div>
  );
}
