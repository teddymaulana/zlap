import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerOrderDetail } from "@/app/actions/customer";
import CancelOrderButton from "../../CancelOrderButton";
import BuyAgainButton from "../../BuyAgainButton";
import QrPayment from "../../../QrPayment";
import { formatStatus } from "@/lib/format";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function badgeClass(status: string) {
  if (status === "paid") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  if (status === "refund_pending" || status === "refunded") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getCustomerOrderDetail(id);
  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/store/account" className="mb-4 inline-block text-sm text-gray-500 hover:underline">
        ← Back to account
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{order.order_id}</h1>
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
        <div className="mb-6 rounded border p-4">
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
            className="mb-6 block rounded bg-[#EE4D2D] px-4 py-3 text-center text-sm font-medium text-white hover:opacity-90"
          >
            Open ShopeePay to pay
          </a>
        )}
      {order.payment_status === "pending" &&
        order.payment_method === "cstore" &&
        order.payment_details?.payment_code && (
          <div className="mb-6 rounded border p-4">
            <div className="text-xs text-gray-500 uppercase">{order.payment_details.store} payment code</div>
            <div className="mt-1 text-xl font-semibold tracking-wide">{order.payment_details.payment_code}</div>
            <p className="mt-2 text-xs text-gray-500">
              Show this code to the cashier at any {order.payment_details.store} store to complete payment.
            </p>
          </div>
        )}

      <div className="mb-6 divide-y rounded border">
        {order.lines.map((l) => (
          <div key={l.product_id} className="flex items-center gap-3 px-4 py-3">
            {l.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.image_url} alt={l.name} className="h-12 w-12 shrink-0 rounded border object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-gray-50 text-[9px] text-gray-400">
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

      <div className="mb-6">
        <BuyAgainButton orderId={order.id} />
      </div>

      {order.awb && (
        <div className="mb-6 rounded border p-4 text-sm">
          <div className="mb-1 text-gray-500">Tracking (AWB)</div>
          <div className="flex items-center justify-between">
            <span className="font-medium">{order.awb}</span>
            <Link href={`/store/track?awb=${encodeURIComponent(order.awb)}`} className="text-black underline">
              Track shipment
            </Link>
          </div>
        </div>
      )}

      {(order.customer_name || order.customer_phone || order.customer_address) && (
        <div className="mb-6 rounded border p-4 text-sm">
          <div className="mb-1 font-medium">Shipping to</div>
          {order.customer_name && <div>{order.customer_name}</div>}
          {order.customer_phone && <div className="text-gray-600">{order.customer_phone}</div>}
          {order.customer_address && <div className="text-gray-600">{order.customer_address}</div>}
        </div>
      )}

      {order.status === "cancelled" ? null : order.cancellation_requested_at ? (
        <p className="text-sm text-yellow-800">Cancellation requested — waiting on review.</p>
      ) : (
        order.status === "pending" && <CancelOrderButton orderId={order.id} />
      )}
    </div>
  );
}
