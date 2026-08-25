"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
        router.push("/store/account/login");
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
