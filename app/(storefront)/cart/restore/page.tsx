"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCartForRestore } from "@/app/actions/carts";
import ZlapLoader from "@/app/ZlapLoader";
import { useCart } from "../../CartContext";

// Landing page for the abandoned-cart email's "View your cart" button: puts
// the saved cart back in this browser (see restoreCart), then drops the
// customer on the homepage with the cart drawer open.
export default function RestoreCartPage() {
  const cartId = useSearchParams().get("c") ?? "";
  const { restoreCart } = useCart();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    getCartForRestore(cartId)
      .then((items) => {
        if (items) restoreCart(cartId, items);
      })
      .catch(() => {})
      .finally(() => router.replace("/"));
  }, [cartId, restoreCart, router]);

  return <ZlapLoader />;
}
