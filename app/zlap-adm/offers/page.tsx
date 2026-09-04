import Link from "next/link";
import { getOffers } from "@/app/actions/adminOffers";
import { formatStatus } from "@/lib/format";
import OfferActions from "./OfferActions";

function formatMoney(amount: number | null) {
  if (amount === null) return "—";
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function badgeClass(status: string) {
  if (status === "approved") return "bg-blue-100 text-blue-800";
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "rejected" || status === "expired") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-800";
}

export default async function OffersPage() {
  const offers = await getOffers();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Offers</h1>
      <div className="divide-y rounded border">
        {offers.map((o) => {
          const belowMin = o.offerMinPrice !== null && o.offered_price < o.offerMinPrice;
          return (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3">
              {o.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.productImageUrl}
                  alt={o.productName}
                  className="h-12 w-12 shrink-0 rounded border object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-gray-50 text-[9px] text-gray-400">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/zlap-adm/products/${o.product_id}`} className="truncate text-sm font-medium hover:underline">
                  {o.productName}
                </Link>
                <div className="text-xs text-gray-500">
                  {o.customer_name || "Guest"} · {o.customer_email} · Qty {o.qty}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className={`font-semibold tabular-nums ${belowMin ? "text-red-600" : "text-gray-900"}`}>
                    Offered {formatMoney(o.offered_price)}
                  </span>
                  <span className="text-gray-400">Current {formatMoney(o.currentPrice)}</span>
                  <span className="text-gray-400">Min {formatMoney(o.offerMinPrice)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(o.status)}`}>
                  {formatStatus(o.status)}
                </span>
                {o.status === "pending" && <OfferActions offerId={o.id} />}
              </div>
            </div>
          );
        })}
        {offers.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No offers yet.</div>}
      </div>
    </div>
  );
}
