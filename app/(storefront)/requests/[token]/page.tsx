"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCardRequestByToken,
  createCardRequestOrderAndCharge,
  type CardRequestCheckoutInfo,
} from "@/app/actions/cardRequests";
import { getCurrentCustomer } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";
import AddressRegionSelect from "../../AddressRegionSelect";
import PaymentMethodPicker, { type PaymentSelection } from "../../checkout/PaymentMethodPicker";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function CardRequestCheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<CardRequestCheckoutInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    getCardRequestByToken(token).then((res) => {
      if (!res) {
        setLoadError("We couldn't find this request.");
      } else if ("error" in res) {
        setLoadError(res.error);
      } else {
        setRequest(res);
        setName((prev) => prev || res.customerName || "");
        setEmail((prev) => prev || res.customerEmail || "");
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

  useEffect(() => {
    if (region) {
      setSubmitError((prev) =>
        prev === "Please complete your Provinsi, Kota, Kecamatan, Kelurahan, and Kode Pos" ? null : prev
      );
    }
  }, [region]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region) {
      setSubmitError("Please complete your Provinsi, Kota, Kecamatan, Kelurahan, and Kode Pos");
      return;
    }
    if (!paymentSelection) {
      setSubmitError("Please select a payment method");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await createCardRequestOrderAndCharge(
        token,
        { name, phone, address: `${address}, ${region}`, email },
        paymentSelection.method,
        paymentSelection.bank
      );
      if ("error" in res) {
        setSubmitError(res.error);
        return;
      }
      // Shows a manual fallback below in case the redirect below doesn't
      // land (e.g. a slow or interrupted client-side transition) — the
      // order is already charged at this point, so the customer needs a
      // way forward rather than a frozen form.
      setCreatedOrderId(res.orderId);
      router.replace(`/checkout?order=${encodeURIComponent(res.orderId)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">Loading your quote…</p>
        </div>
      </div>
    );
  }

  if (loadError || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <p className="text-sm text-red-600">{loadError}</p>
        </div>
      </div>
    );
  }

  if (createdOrderId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-md px-4 py-10 text-center">
          <p className="text-sm text-gray-600">Taking you to your payment details…</p>
          <p className="mt-4 text-xs text-gray-500">
            If this page doesn&apos;t update in a few seconds,{" "}
            <Link
              href={`/checkout?order=${encodeURIComponent(createdOrderId)}`}
              className="text-black underline"
            >
              tap here
            </Link>{" "}
            or reload the page. Your order (<span className="font-medium">{createdOrderId}</span>) has already
            been placed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-6 text-lg font-semibold">Complete your purchase</h1>

        <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
          {request.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={request.imageUrl}
              alt={request.cardName}
              className="h-16 w-16 shrink-0 rounded border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[9px] text-gray-400">
              No image
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{request.cardName}</div>
            <div className="text-xs text-gray-500">Qty {request.qty}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {formatMoney(request.quotedPrice * request.qty)}
            </div>
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
          <AddressRegionSelect onChange={setRegion} />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street name, house/unit number"
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
            <span className={isSubmitting ? "invisible" : ""}>{`Pay ${formatMoney(request.quotedPrice * request.qty)}`}</span>
            {isSubmitting && <ButtonSpinner />}
          </button>
        </form>
      </div>
    </div>
  );
}
