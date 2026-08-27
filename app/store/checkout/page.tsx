"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ButtonSpinner from "@/app/ButtonSpinner";
import { useCart } from "../CartContext";
import {
  createOrderAndCharge,
  getOrderPaymentDetails,
  getOrderPaymentStatus,
  type CheckoutSuccess,
} from "@/app/actions/checkout";
import { getCurrentCustomer } from "@/app/actions/customer";
import QrPayment from "../QrPayment";
import AreaAutocomplete from "../AreaAutocomplete";
import PaymentMethodPicker, { type PaymentSelection } from "./PaymentMethodPicker";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function initialOrderCode() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("order") ?? "";
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutSuccess | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [orderCodeFromUrl] = useState(initialOrderCode);
  const [checkingOrder, setCheckingOrder] = useState(() => !!initialOrderCode());

  // A page reload clears the cart-derived local `result` state (the cart
  // itself is already empty by then) — reconstruct the payment screen from
  // the order code left in the URL instead.
  useEffect(() => {
    if (!orderCodeFromUrl) return;
    getOrderPaymentDetails(orderCodeFromUrl)
      .then((details) => {
        if (details) setResult(details);
      })
      .finally(() => setCheckingOrder(false));
  }, [orderCodeFromUrl]);

  // Poll the order's payment status while the VA/QR/etc. is on screen, so
  // the page reflects payment without the customer needing to refresh.
  // Stops once the status reaches a terminal state.
  useEffect(() => {
    if (!result) return;

    let cancelled = false;
    const terminal = new Set(["paid", "failed", "expired"]);

    const check = async () => {
      const status = await getOrderPaymentStatus(result.orderId);
      if (cancelled) return;
      setPaymentStatus(status);
      if (status && terminal.has(status)) {
        clearInterval(interval);
      }
    };

    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [result]);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setEmail((prev) => prev || customer.email || "");
      setPhone((prev) => prev || customer.phone || "");
      setAddress((prev) => prev || customer.address || "");
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) {
      setError("Please select your area from the suggestions list");
      return;
    }
    if (!paymentSelection) {
      setError("Please select a payment method");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await createOrderAndCharge(
        items.map((i) => ({ productId: i.id, qty: i.qty })),
        { name, phone, address: `${address}, ${area}`, email },
        paymentSelection.method,
        paymentSelection.bank
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      window.history.replaceState(null, "", `/store/checkout?order=${encodeURIComponent(res.orderId)}`);
      clearCart();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <h1 className="mb-4 text-lg font-semibold">Complete your payment</h1>
          <p className="mb-4 text-sm text-gray-600">
            Order <span className="font-medium">{result.orderId}</span> — we&apos;ll process it once
            payment is confirmed.
          </p>
          {paymentStatus === "paid" ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="font-medium">Payment received</div>
              <p className="mt-1 text-green-800">
                Thanks! We&apos;re preparing your order and will email you when it ships.
              </p>
            </div>
          ) : paymentStatus === "failed" || paymentStatus === "expired" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-medium">
                {paymentStatus === "expired" ? "Payment window expired" : "Payment failed"}
              </div>
              <p className="mt-1 text-red-800">Please place the order again to try another payment.</p>
            </div>
          ) : (
            <>
              {result.paymentMethod === "bank_transfer" && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
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
                  className="block rounded-lg bg-[#EE4D2D] px-4 py-3 text-center text-sm font-medium text-white hover:opacity-90"
                >
                  Open ShopeePay to pay
                </a>
              )}
              {result.paymentMethod === "cstore" && result.paymentCode && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-xs text-gray-500 uppercase">{result.store} payment code</div>
                  <div className="mt-1 text-xl font-semibold tracking-wide">{result.paymentCode}</div>
                  <p className="mt-2 text-xs text-gray-500">
                    Show this code to the cashier at any {result.store} store to complete payment.
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                Waiting for payment — this page will update automatically.
              </div>
            </>
          )}
          <p className="mt-6 text-xs text-gray-500">
            Bookmark this page, or use{" "}
            <Link
              href={`/store/orders/lookup?order=${encodeURIComponent(result.orderId)}`}
              className="text-black underline"
            >
              Check your order
            </Link>{" "}
            anytime with your order code and email to see its status.
          </p>
        </div>
      </div>
    );
  }

  if (checkingOrder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">Loading your order…</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">Your cart is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-6 text-lg font-semibold">Checkout</h1>

        <div className="mb-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-10 w-10 shrink-0 rounded border border-gray-200 object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded border border-gray-200 bg-gray-50" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {item.name} × {item.qty}
              </span>
              <span className="shrink-0 tabular-nums">
                {item.price !== null ? formatMoney(item.price * item.qty) : "—"}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Shipping Address</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            required
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <AreaAutocomplete value={area} onChange={setArea} />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street name, house/unit number"
            required
            rows={3}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />

          <h2 className="mb-2 text-sm font-semibold text-gray-700">Payment Method</h2>
          <PaymentMethodPicker value={paymentSelection} onChange={setPaymentSelection} />

          <h2 className="mt-3 mb-2 text-sm font-semibold text-gray-700">Payment Summary</h2>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">Processing Fee</span>
              <span className="font-medium text-green-600">FREE</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">Shipping Fee</span>
              <span className="font-medium text-green-600">FREE</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative rounded-lg bg-black px-4 py-3 text-sm font-medium tabular-nums text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isSubmitting ? "invisible" : ""}>{`Pay ${formatMoney(totalPrice)}`}</span>
            {isSubmitting && <ButtonSpinner />}
          </button>
        </form>
      </div>
    </div>
  );
}
