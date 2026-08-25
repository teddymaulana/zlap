"use client";

import { useEffect, useState } from "react";
import { useCart } from "../CartContext";
import { createOrderAndCharge, type CheckoutResult } from "@/app/actions/checkout";
import { getCurrentCustomer } from "@/app/actions/customer";
import QrPayment from "../QrPayment";
import PaymentMethodPicker, { type PaymentSelection } from "./PaymentMethodPicker";

type CheckoutSuccess = Exclude<CheckoutResult, { error: string }>;

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutSuccess | null>(null);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setPhone((prev) => prev || customer.phone || "");
      setAddress((prev) => prev || customer.address || "");
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSelection) {
      setError("Please select a payment method");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await createOrderAndCharge(
        items.map((i) => ({ productId: i.id, qty: i.qty })),
        { name, phone, address },
        paymentSelection.method,
        paymentSelection.bank
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      clearCart();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-4 text-lg font-semibold">Complete your payment</h1>
        <p className="mb-4 text-sm text-gray-600">
          Order <span className="font-medium">{result.orderId}</span> — we&apos;ll process it once
          payment is confirmed.
        </p>
        {result.paymentMethod === "bank_transfer" && (
          <div className="rounded border p-4">
            <div className="text-xs text-gray-500 uppercase">{result.bank} Virtual Account</div>
            <div className="mt-1 text-xl font-semibold tracking-wide">{result.vaNumber}</div>
          </div>
        )}
        {(result.paymentMethod === "qris" || result.paymentMethod === "gopay") && result.qrUrl && (
          <QrPayment
            qrUrl={result.qrUrl}
            expiry={result.qrExpiry}
            caption={
              result.paymentMethod === "gopay"
                ? "Scan with the Gojek app"
                : "Scan with any QRIS-supported app"
            }
          />
        )}
        {result.paymentMethod === "shopeepay" && result.deeplinkUrl && (
          <a
            href={result.deeplinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded bg-[#EE4D2D] px-4 py-3 text-center text-sm font-medium text-white hover:opacity-90"
          >
            Open ShopeePay to pay
          </a>
        )}
        {result.paymentMethod === "cstore" && result.paymentCode && (
          <div className="rounded border p-4">
            <div className="text-xs text-gray-500 uppercase">{result.store} payment code</div>
            <div className="mt-1 text-xl font-semibold tracking-wide">{result.paymentCode}</div>
            <p className="mt-2 text-xs text-gray-500">
              Show this code to the cashier at any {result.store} store to complete payment.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <p className="text-sm text-gray-500">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-6 text-lg font-semibold">Checkout</h1>

      <div className="mb-6 divide-y rounded border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span>
              {item.name} × {item.qty}
            </span>
            <span className="tabular-nums">
              {item.price !== null ? formatMoney(item.price * item.qty) : "—"}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totalPrice)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          required
          className="rounded border px-3 py-2 text-sm"
        />
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shipping address"
          required
          rows={3}
          className="rounded border px-3 py-2 text-sm"
        />

        <PaymentMethodPicker value={paymentSelection} onChange={setPaymentSelection} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-3 text-sm font-medium tabular-nums text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isSubmitting ? "Processing…" : `Pay ${formatMoney(totalPrice)}`}
        </button>
      </form>
    </div>
  );
}
