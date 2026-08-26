"use client";

import { useState } from "react";
import type { CheckoutPaymentMethod, CheckoutBank } from "@/app/actions/checkout";

export type PaymentSelection = { method: CheckoutPaymentMethod; bank?: CheckoutBank };

// Official brand logos (self-hosted from Wikimedia Commons, since Midtrans's
// Core API — unlike its hosted Snap widget — doesn't return any logo assets).
// ShopeePay has no cleanly-licensed logo available, so it keeps its badge.
const LOGO_BASE =
  "https://xjucizvelqtinmvvnyxr.supabase.co/storage/v1/object/public/site-assets/payment-logos";

const OPTIONS: {
  method: CheckoutPaymentMethod;
  bank?: CheckoutBank;
  label: string;
  subLabel: string;
  badge: string;
  badgeClass: string;
  logoUrl?: string;
}[] = [
  {
    method: "bank_transfer",
    bank: "bca",
    label: "BCA Virtual Account",
    subLabel: "Bank transfer",
    badge: "BCA",
    badgeClass: "bg-blue-700",
    logoUrl: `${LOGO_BASE}/bca.svg`,
  },
  {
    method: "bank_transfer",
    bank: "bni",
    label: "BNI Virtual Account",
    subLabel: "Bank transfer",
    badge: "BNI",
    badgeClass: "bg-orange-600",
    logoUrl: `${LOGO_BASE}/bni.svg`,
  },
  {
    method: "bank_transfer",
    bank: "bri",
    label: "BRI Virtual Account",
    subLabel: "Bank transfer",
    badge: "BRI",
    badgeClass: "bg-sky-700",
    logoUrl: `${LOGO_BASE}/bri.svg`,
  },
  {
    method: "bank_transfer",
    bank: "permata",
    label: "Permata Virtual Account",
    subLabel: "Bank transfer",
    badge: "PMT",
    badgeClass: "bg-teal-700",
    logoUrl: `${LOGO_BASE}/permata.svg`,
  },
  {
    method: "qris",
    label: "QRIS",
    subLabel: "Scan with any e-wallet",
    badge: "QR",
    badgeClass: "bg-gray-900",
    logoUrl: `${LOGO_BASE}/qris.svg`,
  },
  {
    method: "gopay",
    label: "GoPay",
    subLabel: "Pay with the Gojek app",
    badge: "G",
    badgeClass: "bg-[#00AA13]",
    logoUrl: `${LOGO_BASE}/gopay.svg`,
  },
  {
    method: "shopeepay",
    label: "ShopeePay",
    subLabel: "Pay with the Shopee app",
    badge: "S",
    badgeClass: "bg-[#EE4D2D]",
  },
];

function OptionIcon({
  option,
  size,
}: {
  option: (typeof OPTIONS)[number];
  size: number;
}) {
  if (option.logoUrl) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={option.logoUrl} alt={option.label} className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${option.badgeClass}`}
      style={{ width: size, height: size }}
    >
      {option.badge}
    </span>
  );
}

export default function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentSelection | null;
  onChange: (selection: PaymentSelection) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = value
    ? OPTIONS.find((opt) => opt.method === value.method && opt.bank === value.bank)
    : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-3 text-left hover:border-gray-300"
      >
        {selectedOption ? (
          <span className="flex min-w-0 items-center gap-3">
            <OptionIcon option={selectedOption} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{selectedOption.label}</span>
              <span className="block truncate text-xs text-gray-500">{selectedOption.subLabel}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-gray-500">Select payment</span>
        )}
        <span className="shrink-0 text-xs text-gray-400">Change</span>
      </button>

      {isOpen && (
        <>
          <div
            aria-hidden
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <div
            role="dialog"
            aria-label="Select payment method"
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[80vh] max-w-sm -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Select payment</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-xl text-gray-500 hover:text-black"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {OPTIONS.map((opt) => {
                const selected = value?.method === opt.method && value?.bank === opt.bank;
                return (
                  <button
                    key={`${opt.method}-${opt.bank ?? ""}`}
                    type="button"
                    onClick={() => {
                      onChange({ method: opt.method, bank: opt.bank });
                      setIsOpen(false);
                    }}
                    aria-pressed={selected}
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                      selected ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <OptionIcon option={opt} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{opt.label}</span>
                      <span className="block truncate text-xs text-gray-500">{opt.subLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
