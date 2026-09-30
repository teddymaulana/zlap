import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PreorderQueue, { type QueueGroup } from "./PreorderQueue";
import PriceAlertDismiss from "./PriceAlertDismiss";
import RefreshAllPrices from "./RefreshAllPrices";
import { hasPoPriceIncrease } from "@/lib/preorder";

// Raised for the "Refresh all prices" server action, which walks every
// pre-order product one at a time.
export const maxDuration = 300;

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

// Paid pre-order items not yet in a purchase, grouped by product — staff
// tick the ones to buy together and create a purchase from them
// (createPoPurchase), which then tracks their progress to the customer.
export default async function PreordersPage() {
  const supabase = await createClient();
  const [
    { data: lines, error },
    { data: openPurchases, error: purchasesError },
    { data: poProducts, error: poProductsError },
    { data: openCounts, error: openCountsError },
  ] = await Promise.all([
    supabase
      .from("order_lines")
      .select(
        "id, product_id, price, orders!inner(id, order_id, date, customer_name, payment_status, status), products(name, image_url, snkrdunk_url)"
      )
      .eq("is_po", true)
      .is("po_purchase_id", null)
      .eq("orders.payment_status", "paid")
      .neq("orders.status", "cancelled"),
    supabase
      .from("purchases")
      .select("id, name, po_status, date")
      .not("po_status", "is", null)
      .neq("po_status", "arrived")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, po_price, po_price_previous, po_price_changed_at, po_price_alert_dismissed_at")
      .eq("po_enabled", true),
    supabase.from("product_po_open").select("product_id, open_count"),
  ]);
  if (error) throw new Error(error.message);
  if (purchasesError) throw new Error(purchasesError.message);
  if (poProductsError) throw new Error(poProductsError.message);
  if (openCountsError) throw new Error(openCountsError.message);

  const openCountById = new Map((openCounts ?? []).map((r) => [r.product_id, Number(r.open_count)]));
  const priceAlerts = (poProducts ?? []).filter(hasPoPriceIncrease);

  const groups = new Map<string, QueueGroup>();
  for (const line of lines ?? []) {
    const order = line.orders as unknown as { id: string; order_id: string; date: string | null; customer_name: string | null };
    const product = line.products as unknown as { name: string; image_url: string | null; snkrdunk_url: string | null } | null;
    const group: QueueGroup = groups.get(line.product_id) ?? {
      productId: line.product_id,
      name: product?.name ?? "Unknown product",
      imageUrl: product?.image_url ?? null,
      snkrdunkUrl: product?.snkrdunk_url ?? null,
      lines: [],
    };
    group.lines.push({
      id: line.id,
      orderInternalId: order.id,
      orderCode: order.order_id,
      customerName: order.customer_name,
      date: order.date,
      price: line.price,
    });
    groups.set(line.product_id, group);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pre-order queue</h1>
        <RefreshAllPrices />
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Paid pre-order items waiting to be bought in Japan. Select the ones you&apos;re buying together and create a
        purchase — customers follow its progress on their order page.
      </p>

      {priceAlerts.length > 0 && (
        <div className="mb-6 rounded border border-orange-300 bg-orange-50 p-3">
          <h2 className="mb-2 text-sm font-semibold text-orange-900">Pre-order prices went up</h2>
          <div className="flex flex-col gap-1.5">
            {priceAlerts.map((p) => {
              const open = openCountById.get(p.id) ?? 0;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm text-orange-900">
                  <Link href={`/zlap-adm/products/${p.id}`} className="font-medium underline">
                    {p.name}
                  </Link>
                  <span>
                    {formatMoney(Number(p.po_price_previous))} → {formatMoney(Number(p.po_price))} (+
                    {Math.round((Number(p.po_price) / Number(p.po_price_previous) - 1) * 100)}%)
                  </span>
                  {open > 0 && (
                    <span className="text-xs">
                      · {open} open pre-order{open === 1 ? "" : "s"} sold at an earlier price
                    </span>
                  )}
                  <PriceAlertDismiss productId={p.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PreorderQueue groups={[...groups.values()]} />

      {(openPurchases ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Pre-order purchases in progress</h2>
          <div className="divide-y rounded border">
            {(openPurchases ?? []).map((p) => (
              <Link
                key={p.id}
                href={`/zlap-adm/purchases/${p.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
              >
                <span>{p.name || "Purchase"}</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{p.po_status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
