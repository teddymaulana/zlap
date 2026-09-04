"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ButtonSpinner from "@/app/ButtonSpinner";
import PageSpinner from "@/app/PageSpinner";
import { useCart } from "../CartContext";
import {
  createOrderAndCharge,
  getOrderPaymentDetails,
  getOrderPaymentStatus,
  type CheckoutSuccess,
} from "@/app/actions/checkout";
import { getCurrentCustomer } from "@/app/actions/customer";
import QrPayment from "../QrPayment";
import AddressRegionSelect from "../AddressRegionSelect";
import FloatingLabelInput from "../FloatingLabelInput";
import FloatingLabelTextarea from "../FloatingLabelTextarea";
import PaymentMethodPicker, { type PaymentSelection } from "./PaymentMethodPicker";
import { copy, fillCopy } from "@/lib/copy";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

// Device-local only — deliberately never sent to the server. The customers
// table intentionally doesn't store addresses server-side (see the comment
// on it in supabase/schema.sql), so "remember my shipping info" here is a
// per-browser convenience, not an account feature.
const SAVED_SHIPPING_KEY = "zlap_saved_shipping";

type SavedShipping = { name: string; phone: string; address: string; region: string };

function readSavedShipping(): SavedShipping | null {
  try {
    const raw = localStorage.getItem(SAVED_SHIPPING_KEY);
    return raw ? (JSON.parse(raw) as SavedShipping) : null;
  } catch {
    return null;
  }
}

function writeSavedShipping(value: SavedShipping | null) {
  try {
    if (value) localStorage.setItem(SAVED_SHIPPING_KEY, JSON.stringify(value));
    else localStorage.removeItem(SAVED_SHIPPING_KEY);
  } catch {
    // Private browsing / storage disabled — saving is a convenience, never required.
  }
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [savedRegion, setSavedRegion] = useState<string | null>(null);
  const [saveShipping, setSaveShipping] = useState(false);
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutSuccess | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  // Read reactively (not a one-time useState initializer): this route can be
  // reached via router.replace() from the card-request quote checkout, and
  // with Activity preserving previously-visited routes, a `/checkout`
  // instance from earlier in the session can be reused instead of remounted
  // — a snapshot taken once at mount would keep showing the old (or empty)
  // order code.
  const orderCodeFromUrl = useSearchParams().get("order") ?? "";
  // Tracks which order code the fetch below has actually resolved for, so
  // `checkingOrder` can be derived instead of toggled by hand — that way it
  // naturally flips back to true if `orderCodeFromUrl` changes again (e.g.
  // this preserved instance gets reused for a different order) rather than
  // needing a synchronous setState at the top of the effect.
  const [resolvedOrderCode, setResolvedOrderCode] = useState<string | null>(null);
  const checkingOrder = !!orderCodeFromUrl && resolvedOrderCode !== orderCodeFromUrl;
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // A page reload (or a route swap into this preserved instance) clears the
  // cart-derived local `result` state — reconstruct the payment screen from
  // the order code in the URL instead.
  useEffect(() => {
    if (!orderCodeFromUrl) return;
    let cancelled = false;
    getOrderPaymentDetails(orderCodeFromUrl).then((details) => {
      if (cancelled) return;
      if (details) setResult(details);
      setResolvedOrderCode(orderCodeFromUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [orderCodeFromUrl]);

  const isTerminalStatus = (status: string | null) =>
    status === "paid" || status === "failed" || status === "expired";

  // Poll the order's payment status while the VA/QR/etc. is on screen, so
  // the page reflects payment without the customer needing to refresh.
  // Stops once the status reaches a terminal state.
  useEffect(() => {
    if (!result) return;

    let cancelled = false;

    const check = async () => {
      const status = await getOrderPaymentStatus(result.orderId);
      if (cancelled) return;
      setPaymentStatus(status);
      if (isTerminalStatus(status)) {
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

  // Manual fallback for "Check status now" — the notification webhook
  // usually updates payment_status within a few seconds, but this lets the
  // customer force a re-check if it's ever delayed or dropped.
  const checkStatusNow = useCallback(async () => {
    if (!result || isTerminalStatus(paymentStatus)) return;
    setIsCheckingStatus(true);
    try {
      const status = await getOrderPaymentStatus(result.orderId);
      setPaymentStatus(status);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [result, paymentStatus]);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setEmail((prev) => prev || customer.email || "");
      setPhone((prev) => prev || customer.phone || "");
    });
  }, []);

  useEffect(() => {
    const saved = readSavedShipping();
    if (!saved) return;
    setName((prev) => prev || saved.name);
    setPhone((prev) => prev || saved.phone);
    setAddress((prev) => prev || saved.address);
    setSavedRegion(saved.region);
    setSaveShipping(true);
  }, []);

  // These two errors are only ever set from handleSubmit's pre-checks below —
  // clear each one the moment its own field becomes valid, rather than
  // leaving it on screen until the next submit attempt re-evaluates it.
  useEffect(() => {
    if (region) {
      setError((prev) => (prev === copy.checkout.missingRegion ? null : prev));
    }
  }, [region]);

  useEffect(() => {
    if (paymentSelection) {
      setError((prev) => (prev === copy.checkout.missingPaymentMethod ? null : prev));
    }
  }, [paymentSelection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region) {
      setError(copy.checkout.missingRegion);
      return;
    }
    if (!paymentSelection) {
      setError(copy.checkout.missingPaymentMethod);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    writeSavedShipping(saveShipping ? { name, phone, address, region } : null);
    try {
      const res = await createOrderAndCharge(
        items.map((i) => ({ productId: i.id, qty: i.qty })),
        { name, phone, address: `${address}, ${region}`, email },
        paymentSelection.method,
        paymentSelection.bank
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      window.history.replaceState(null, "", `/checkout?order=${encodeURIComponent(res.orderId)}`);
      clearCart();
      // The form can be long enough that the Pay button sits well below the
      // fold — jump back up so the payment screen is actually visible.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <h1 className="mb-4 text-lg font-semibold">{copy.checkout.completeTitle}</h1>
          <p className="mb-4 text-sm text-gray-600">
            {copy.checkout.orderPrefix} <span className="font-medium">{result.orderId}</span>{" "}
            {copy.checkout.orderSuffix}
          </p>
          {paymentStatus === "paid" ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="font-medium">{copy.checkout.paymentReceived}</div>
              <p className="mt-1 text-green-800">{copy.checkout.paymentReceivedBody}</p>
            </div>
          ) : paymentStatus === "failed" || paymentStatus === "expired" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-medium">
                {paymentStatus === "expired" ? copy.checkout.paymentWindowExpired : copy.checkout.paymentFailed}
              </div>
              <p className="mt-1 text-red-800">{copy.checkout.tryAgainBody}</p>
            </div>
          ) : (
            <>
              {result.paymentMethod === "bank_transfer" && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-xs text-gray-500 uppercase">
                    {result.bank} {copy.payment.virtualAccount}
                  </div>
                  <div className="mt-1 text-xl font-semibold tracking-wide">{result.vaNumber}</div>
                </div>
              )}
              {(result.paymentMethod === "qris" || result.paymentMethod === "gopay") && result.qrUrl && (
                <QrPayment
                  qrUrl={result.qrUrl}
                  expiry={result.qrExpiry}
                  caption={
                    result.paymentMethod === "gopay" ? copy.payment.scanGopay : copy.payment.scanQris
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
                  {copy.payment.openShopeepay}
                </a>
              )}
              {result.paymentMethod === "cstore" && result.paymentCode && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-xs text-gray-500 uppercase">
                    {fillCopy(copy.payment.paymentCode, { store: result.store ?? "" })}
                  </div>
                  <div className="mt-1 text-xl font-semibold tracking-wide">{result.paymentCode}</div>
                  <p className="mt-2 text-xs text-gray-500">
                    {fillCopy(copy.payment.cashierNote, { store: result.store ?? "" })}
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                  {copy.checkout.waitingForPayment}
                </div>
                <button
                  type="button"
                  onClick={checkStatusNow}
                  disabled={isCheckingStatus}
                  className="shrink-0 text-xs font-medium text-black underline disabled:opacity-50"
                >
                  {isCheckingStatus ? copy.checkout.checking : copy.checkout.checkStatusNow}
                </button>
              </div>
            </>
          )}
          <p className="mt-6 text-xs text-gray-500">
            {copy.checkout.bookmarkNotice}{" "}
            <Link
              href={`/orders/lookup?order=${encodeURIComponent(result.orderId)}`}
              className="text-black underline"
            >
              {copy.common.checkYourOrder}
            </Link>{" "}
            {copy.checkout.orLookupSuffix}
          </p>
        </div>
      </div>
    );
  }

  if (checkingOrder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-24">
          <PageSpinner label={copy.checkout.loadingOrder} />
        </div>
      </div>
    );
  }

  // Reached via a ?order= link (e.g. the admin checkout-link email, or a
  // bookmarked/shared payment URL) but the order didn't resolve — distinct
  // from simply having no cart items, which is what a bare /checkout
  // visit with nothing in the cart looks like.
  if (orderCodeFromUrl && !result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-red-600">{copy.checkout.orderNotFound}</p>
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
            Masih ada pertanyaan? Hubungi kami via{" "}
            <a
              href={`https://wa.me/6285121369155?text=${encodeURIComponent(
                "Halo, saya ingin bertanya tentang pesanan saya."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black underline"
            >
              WhatsApp
            </a>{" "}
            atau{" "}
            <a href="mailto:info@zlapcard.com" className="font-medium text-black underline">
              email
            </a>
            .
          </div>
          <Link href="/" className="mt-4 inline-block text-sm text-black underline">
            {copy.checkout.backToStore}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">{copy.checkout.emptyCart}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-6 text-lg font-semibold">{copy.checkout.title}</h1>

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
          <h2 className="mb-1 text-lg font-bold text-black">{copy.checkout.shippingAddress}</h2>
          <FloatingLabelInput
            type="text"
            label={copy.common.fullName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <FloatingLabelInput
            type="email"
            label={copy.common.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FloatingLabelInput
            type="tel"
            label={copy.common.phoneNumber}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <AddressRegionSelect onChange={setRegion} initialRegion={savedRegion} />
          <FloatingLabelTextarea
            label={copy.checkout.streetLabel}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={saveShipping}
              onChange={(e) => setSaveShipping(e.target.checked)}
              className="h-4 w-4"
            />
            Save shipping details on this device for faster checkout next time
          </label>

          <h2 className="mt-2 mb-1 text-lg font-bold text-black">{copy.checkout.paymentMethodHeading}</h2>
          <PaymentMethodPicker value={paymentSelection} onChange={setPaymentSelection} />

          <h2 className="mt-2 mb-1 text-lg font-bold text-black">{copy.checkout.paymentSummary}</h2>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">{copy.checkout.subtotal}</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">{copy.checkout.processingFee}</span>
              <span className="font-medium text-green-600">{copy.checkout.free}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">{copy.checkout.shippingFee}</span>
              <span className="font-medium text-green-600">{copy.checkout.free}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm font-semibold">
              <span>{copy.common.total}</span>
              <span className="tabular-nums">{formatMoney(totalPrice)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative rounded-lg bg-black px-4 py-3 text-sm font-medium tabular-nums text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isSubmitting ? "invisible" : ""}>
              {copy.checkout.payLabel} {formatMoney(totalPrice)}
            </span>
            {isSubmitting && <ButtonSpinner />}
          </button>
        </form>
      </div>
    </div>
  );
}
