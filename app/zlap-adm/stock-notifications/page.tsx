import Link from "next/link";
import { getStockNotifications } from "@/app/actions/adminStockNotifications";
import StockNotificationActions from "./StockNotificationActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function StockNotificationsPage() {
  const notifications = await getStockNotifications();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Stock notifications</h1>
      <div className="divide-y rounded border">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-center gap-3 px-4 py-3">
            {n.productImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={n.productImageUrl}
                alt={n.productName}
                className="h-12 w-12 shrink-0 rounded border object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-gray-50 text-[9px] text-gray-400">
                No image
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/zlap-adm/products/${n.product_id}`} className="truncate text-sm font-medium hover:underline">
                {n.productName}
              </Link>
              <div className="text-xs text-gray-500">
                {n.email && <span>{n.email}</span>}
                {n.email && n.phone && <span> · </span>}
                {n.phone && <span>{n.phone}</span>}
              </div>
              <div className="text-xs text-gray-400">{formatDate(n.created_at)}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {n.notified && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Notified</span>
              )}
              <StockNotificationActions id={n.id} notified={n.notified} />
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No stock notification requests yet.</div>
        )}
      </div>
    </div>
  );
}
