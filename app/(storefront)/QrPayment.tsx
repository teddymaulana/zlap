"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

export default function QrPayment({
  qrUrl,
  expiry,
  caption = copy.payment.scanQris,
}: {
  qrUrl: string;
  expiry?: string;
  caption?: string;
}) {
  const [isExpired, setIsExpired] = useState(() => (expiry ? new Date(expiry) < new Date() : false));

  useEffect(() => {
    if (!expiry || isExpired) return;
    const msUntilExpiry = new Date(expiry).getTime() - Date.now();
    const timer = setTimeout(() => setIsExpired(true), Math.max(0, msUntilExpiry));
    return () => clearTimeout(timer);
  }, [expiry, isExpired]);

  if (isExpired) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
        <p className="text-sm text-red-600">{copy.payment.qrExpired}</p>
        <p className="mt-1 text-xs text-gray-500">{copy.payment.qrExpiredNotice}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt={copy.payment.qrAlt} className="mx-auto h-56 w-56" />
      <p className="mt-2 text-xs text-gray-500">{caption}</p>
    </div>
  );
}
