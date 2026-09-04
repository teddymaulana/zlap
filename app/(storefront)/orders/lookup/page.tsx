"use client";

import { useState } from "react";
import Link from "next/link";
import { getGuestOrderDetail, type CustomerOrderDetail } from "@/app/actions/customer";
import { formatStatus } from "@/lib/format";
import ButtonSpinner from "@/app/ButtonSpinner";
import QrPayment from "../../QrPayment";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function badgeClass(status: string) {
  if (status === "paid") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  if (status === "refund_pending" || status === "refunded") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

function initialOrderCode() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("order") ?? "";
}

export default function GuestOrderLookupPage() {
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setNotFoundMsg(null);
    setOrder(null);
    try {
      const found = await getGuestOrderDetail(orderCode, email);
      if (!found) {
        setNotFoundMsg("We couldn't find an order with that code and email.");
        return;
      }
      setOrder(found);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-lg font-semibold">Check your order</h1>
        <p className="mb-6 text-sm text-gray-500">
          Masukkan kode pesanan dan email yang Anda gunakan saat checkout.
        </p>

        <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="Order code (e.g. ZLAP-1234567890)"
            required
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="relative rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isSearching ? "invisible" : ""}>Check status</span>
            {isSearching && <ButtonSpinner />}
          </button>
        </form>

        {notFoundMsg && <p className="text-sm text-red-600">{notFoundMsg}</p>}

        {order && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{order.order_id}</h2>
                <div className="text-sm text-gray-500">{order.date}</div>
              </div>
              <div className="flex items-center gap-2">
                {order.status === "cancelled" && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Cancelled</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(order.payment_status)}`}>
                  {formatStatus(order.payment_status)}
                </span>
              </div>
            </div>

            {order.payment_status === "pending" && order.payment_method === "bank_transfer" && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500 uppercase">{order.payment_details?.bank} Virtual Account</div>
                <div className="mt-1 text-xl font-semibold tracking-wide">{order.payment_details?.va_number}</div>
              </div>
            )}
            {order.payment_status === "pending" &&
              (order.payment_method === "qris" || order.payment_method === "gopay") &&
              order.payment_details?.qr_url && (
                <div className="mb-6">
                  <QrPayment
                    qrUrl={order.payment_details.qr_url}
                    expiry={order.payment_details.qr_expiry}
                    caption={
                      order.payment_method === "gopay"
                        ? "Scan with the Gojek app"
                        : "Scan with any QRIS-supported app"
                    }
                  />
                </div>
              )}
            {order.payment_status === "pending" &&
              order.payment_method === "shopeepay" &&
              order.payment_details?.deeplink_url && (
                <a
                  href={order.payment_details.deeplink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6 block rounded-lg bg-[#EE4D2D] px-4 py-3 text-center text-sm font-medium text-white hover:opacity-90"
                >
                  Open ShopeePay to pay
                </a>
              )}
            {order.payment_status === "pending" &&
              order.payment_method === "cstore" &&
              order.payment_details?.payment_code && (
                <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-xs text-gray-500 uppercase">{order.payment_details.store} payment code</div>
                  <div className="mt-1 text-xl font-semibold tracking-wide">{order.payment_details.payment_code}</div>
                  <p className="mt-2 text-xs text-gray-500">
                    Show this code to the cashier at any {order.payment_details.store} store to complete payment.
                  </p>
                </div>
              )}

            <div className="mb-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
              {order.lines.map((l) => (
                <div key={l.product_id} className="flex items-center gap-3 px-4 py-3">
                  {l.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.image_url}
                      alt={l.name}
                      className="h-12 w-12 shrink-0 rounded border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[9px] text-gray-400">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="text-gray-500">Qty {l.qty}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(l.price * l.qty)}</div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(order.total)}</span>
              </div>
            </div>

            {order.awb && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm">
                <div className="mb-1 text-gray-500">Tracking (AWB)</div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{order.awb}</span>
                  <Link href={`/track?awb=${encodeURIComponent(order.awb)}`} className="text-black underline">
                    Track shipment
                  </Link>
                </div>
              </div>
            )}

            {(order.customer_name || order.customer_phone || order.customer_address) && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                <div className="mb-1 font-medium">Shipping to</div>
                {order.customer_name && <div>{order.customer_name}</div>}
                {order.customer_phone && <div className="text-gray-600">{order.customer_phone}</div>}
                {order.customer_address && <div className="text-gray-600">{order.customer_address}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
