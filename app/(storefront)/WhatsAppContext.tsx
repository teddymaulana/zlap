"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type WhatsAppProduct = { name: string; path: string } | null;

type WhatsAppContextValue = {
  product: WhatsAppProduct;
  setProduct: (product: WhatsAppProduct) => void;
};

const WhatsAppContext = createContext<WhatsAppContextValue | null>(null);

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<WhatsAppProduct>(null);

  return (
    <WhatsAppContext.Provider value={{ product, setProduct }}>{children}</WhatsAppContext.Provider>
  );
}

export function useWhatsAppContext() {
  const ctx = useContext(WhatsAppContext);
  if (!ctx) throw new Error("useWhatsAppContext must be used within a WhatsAppProvider");
  return ctx;
}
