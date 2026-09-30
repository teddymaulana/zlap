"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { toggleWishlist, getWishlistProductIds } from "@/app/actions/customer";

type WishlistContextValue = {
  productIds: Set<string>;
  toggle: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    getWishlistProductIds().then((ids) => setProductIds(new Set(ids)));
  }, []);

  const toggle = (productId: string) => {
    if (!productIds.has(productId)) {
      trackEvent("Wishlist Add", { productId }, { event: "add_to_wishlist", params: { items: [{ item_id: productId }] } });
    }
    // Optimistic update — reconciled with the server result below.
    setProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });

    toggleWishlist(productId).then((res) => {
      if (res.error === "not_signed_in") {
        setProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        router.push("/account/login");
        return;
      }
      setProductIds((prev) => {
        const next = new Set(prev);
        if (res.wishlisted) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return next;
      });
    });
  };

  return (
    <WishlistContext.Provider value={{ productIds, toggle }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
