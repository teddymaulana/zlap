"use client";

import { useEffect, useState } from "react";
import { useWhatsAppContext } from "./WhatsAppContext";

const WHATSAPP_NUMBER = "6285121369155";
const DEFAULT_MESSAGE = "Halo, saya ingin bertanya tentang produk kalian.";

function buildMessage(product: { name: string; path: string } | null, origin: string) {
  if (!product) return DEFAULT_MESSAGE;
  const link = origin ? `${origin}${product.path}` : product.path;
  return `Halo, saya tertarik dengan produk "${product.name}" (${link}). Apakah masih tersedia?`;
}

export default function WhatsAppFloatingButton() {
  const { product } = useWhatsAppContext();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage(product, origin))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-7 w-7"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.03.32-3.42-.72-2.9-1.26-4.76-4.24-4.9-4.44-.14-.2-1.17-1.56-1.17-2.97s.73-2.1 1-2.39c.24-.26.53-.32.71-.32.18 0 .35 0 .5.01.17.01.38-.06.6.45.24.55.8 1.9.87 2.04.07.14.11.3.02.49-.09.19-.14.3-.27.46-.14.16-.28.36-.4.48-.14.13-.28.28-.12.55.16.27.71 1.16 1.52 1.88 1.05.93 1.93 1.22 2.2 1.36.27.14.43.12.59-.07.16-.19.68-.79.87-1.06.18-.27.36-.22.6-.13.24.08 1.55.73 1.82.87.27.13.44.2.5.31.07.12.07.66-.17 1.34Z" />
      </svg>
    </a>
  );
}
