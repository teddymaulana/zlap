"use client";

import { useEffect } from "react";
import { useWhatsAppContext } from "./WhatsAppContext";

// Renders nothing — just tells the floating WhatsApp button which product
// is currently being viewed, so its prefilled message can reference it.
export default function WhatsAppProductAnnouncer({ name, path }: { name: string; path: string }) {
  const { setProduct } = useWhatsAppContext();

  useEffect(() => {
    setProduct({ name, path });
    return () => setProduct(null);
  }, [name, path, setProduct]);

  return null;
}
