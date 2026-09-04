"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrderByToken, payOrderByToken, type OrderCheckoutInfo } from "@/app/actions/orderCheckout";
import { getCurrentCustomer } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";
import PaymentMethodPicker, { type PaymentSelection } from "../../checkout/PaymentMethodPicker";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function OrderPayPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderCheckoutInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getOrderByToken(token).then((res) => {
      if (!res) {
        setLoadError("We couldn't find this order.");
      } else if ("error" in res) {
        setLoadError(res.error);
      } else {
        setOrder(res);
        setName((prev) => prev || res.customerName || "");
        setEmail((prev) => prev || res.customerEmail || "");
        setPhone((prev) => prev || res.customerPhone || "");
      }
      setIsLoading(false);
    });
  }, [token]);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setEmail((prev) => prev || customer.email || "");
      setPhone((prev) => prev || customer.phone || "");
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSelection) {
      setSubmitError("Please select a payment method");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await payOrderByToken(
        token,
        { name, phone, address, email },
        paymentSelection.method,
        paymentSelection.bank
      );
      if ("error" in res) {
        setSubmitError(res.error);
        return;
      }
      router.replace(`/checkout?order=${encodeURIComponent(res.orderId)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">Loading your order…</p>
        </div>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-red-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-6 text-lg font-semibold">Complete your order</h1>

        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          {order.lines.map((line, i) => (
            <div key={i} className="flex items-center gap-3">
              {line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.imageUrl}
                  alt={line.productName}
                  className="h-12 w-12 shrink-0 rounded border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[9px] text-gray-400">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1 truncate text-sm">{line.productName}</div>
              <div className="text-sm font-semibold tabular-nums">{formatMoney(line.price)}</div>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(order.total)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shipping address"
            required
            rows={3}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />

          <PaymentMethodPicker value={paymentSelection} onChange={setPaymentSelection} />

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative rounded-lg bg-black px-4 py-3 text-sm font-medium tabular-nums text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isSubmitting ? "invisible" : ""}>{`Pay ${formatMoney(order.total)}`}</span>
            {isSubmitting && <ButtonSpinner />}
          </button>
        </form>
      </div>
    </div>
  );
}
