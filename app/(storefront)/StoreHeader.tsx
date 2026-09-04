"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartContext";
import { getCurrentCustomer } from "@/app/actions/customer";
import { copy } from "@/lib/copy";

export default function StoreHeader({ tagline }: { tagline: string }) {
  const { openCart, totalCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);
  // Defaults to "Sign In" (the common case for a first-time visitor) until
  // the session check resolves, rather than flashing "Account" for guests.
  const [accountLabel, setAccountLabel] = useState(copy.header.signIn);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (customer) setAccountLabel(copy.header.account);
    });
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b bg-white">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-3 items-center px-4 py-2">
        <div className="col-start-1 flex items-center gap-2 justify-self-start">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label={copy.header.openMenu}
            className="rounded-full p-2 hover:bg-gray-100 sm:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/zlap-logo.png"
              alt="Zlap"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
          </Link>
          <span className="hidden text-xs font-normal text-gray-600 sm:inline">{tagline}</span>
        </div>
        <span className="col-start-2 justify-self-start text-left text-xs font-normal text-gray-600 sm:hidden">
          {tagline}
        </span>
        <div className="col-start-3 flex items-center gap-3 justify-self-end">
          <Link
            href="/request"
            className="hidden text-sm text-gray-600 hover:text-black sm:inline"
          >
            {copy.header.requestCard}
          </Link>
          <Link
            href="/track"
            className="hidden text-sm text-gray-600 hover:text-black sm:inline"
          >
            {copy.header.trackOrder}
          </Link>
          <Link
            href="/account"
            className="hidden text-sm text-gray-600 hover:text-black sm:inline"
          >
            {accountLabel}
          </Link>
          <button
            type="button"
            onClick={openCart}
            aria-label={copy.header.openCart}
            className="relative rounded-full p-2 hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        aria-hidden={!isMenuOpen}
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity sm:hidden ${
          isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-label={copy.header.menuAria}
        className={`fixed top-0 left-0 z-50 flex h-full w-full max-w-xs flex-col bg-white shadow-xl transition-transform sm:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-lg font-bold tracking-wide">{copy.common.brandName}</span>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={copy.header.closeMenu}
            className="text-xl text-gray-500 hover:text-black"
          >
            ×
          </button>
        </div>
        <nav className="flex flex-col px-4 py-3">
          <Link
            href="/request"
            onClick={closeMenu}
            className="py-3 text-sm text-gray-600 hover:text-black"
          >
            {copy.header.requestCard}
          </Link>
          <Link
            href="/track"
            onClick={closeMenu}
            className="py-3 text-sm text-gray-600 hover:text-black"
          >
            {copy.header.trackOrder}
          </Link>
          <Link
            href="/account"
            onClick={closeMenu}
            className="py-3 text-sm text-gray-600 hover:text-black"
          >
            {accountLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
