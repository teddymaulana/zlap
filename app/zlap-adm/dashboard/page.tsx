import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Balance, InventoryBatchAvailability, MarketplaceBalances } from "@/lib/types";
import Pagination from "@/app/Pagination";
import MarketplaceBalanceForm from "./MarketplaceBalanceForm";

const SALES_PAGE_SIZE = 10;
const INVENTORY_PAGE_SIZE = 10;
const FETCH_BATCH_SIZE = 1000;

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

function formatMonthLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type OrderLineRow = {
  order_id: string;
  product_id: string;
  inventory_batch_id: string | null;
  price: number | null;
};

type OrderRow = {
  id: string;
  channel: string | null;
  date: string | null;
};

// PostgREST caps rows per request (commonly 1000) regardless of the .range()
// requested, so a single query silently truncates once a table exceeds that
// cap. Loop until a page comes back short to fetch everything.
async function fetchAllRows<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  columns: string
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + FETCH_BATCH_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < FETCH_BATCH_SIZE) break;
    from += FETCH_BATCH_SIZE;
  }
  return all;
}

const CHANNELS = ["tokopedia", "shopee", "website", "direct"] as const;

const SOLD_CATEGORIES = [
  { value: "booster_box", label: "Booster Box" },
  { value: "graded", label: "Graded Cards" },
  { value: "etb", label: "ETB" },
  { value: "special_box", label: "Special Boxes" },
  { value: "accessories", label: "Accessories" },
  { value: "other", label: "Other" },
] as const;

function classifyProduct(tags: string[], name: string): (typeof SOLD_CATEGORIES)[number]["value"] {
  if (tags.includes("booster_box")) return "booster_box";
  if (tags.includes("graded")) return "graded";
  if (tags.includes("etb")) return "etb";
  if (tags.includes("special_box")) return "special_box";
  if (/toploader|sleeve|protector/i.test(name)) return "accessories";
  return "other";
}

type ProductSales = {
  productId: string;
  name: string;
  soldQty: number;
  revenue: number;
  cost: number;
};

type ProductInventory = {
  productId: string;
  name: string;
  available: number;
  totalValue: number;
  net: number;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    invPage?: string;
    month?: string;
    channel?: string;
    cat?: string;
  }>;
}) {
  const {
    page: pageParam,
    invPage: invPageParam,
    month: monthParam,
    channel: channelFilter,
    cat: catFilter,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const invPage = Math.max(1, Number(invPageParam) || 1);
  // Absent "month" (first load, no query string) defaults to the current
  // month. An explicitly empty value (user picked "All time") stays empty.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthFilter = monthParam === undefined ? currentMonth : monthParam;

  const supabase = await createClient();
  const [
    { data: batches, error: batchesError },
    { data: balances, error: balancesError },
    { data: products, error: productsError },
    { data: allBatches, error: allBatchesError },
    { data: marketplaceBalances, error: marketplaceBalancesError },
    orderLines,
    orders,
  ] = await Promise.all([
    supabase.from("inventory_batch_availability").select("product_id, cost, available"),
    supabase.from("balances").select("type, amount, category, name, notes, date"),
    supabase.from("products").select("id, name, tags"),
    supabase.from("inventory_batches").select("id, cost"),
    supabase.from("marketplace_balances").select("*").maybeSingle(),
    fetchAllRows<OrderLineRow>(supabase, "order_lines", "order_id, product_id, inventory_batch_id, price"),
    fetchAllRows<OrderRow>(supabase, "orders", "id, channel, date"),
  ]);
  if (batchesError) throw new Error(batchesError.message);
  if (balancesError) throw new Error(balancesError.message);
  if (productsError) throw new Error(productsError.message);
  if (allBatchesError) throw new Error(allBatchesError.message);
  if (marketplaceBalancesError) throw new Error(marketplaceBalancesError.message);

  const typedBatches = (batches ?? []) as Pick<
    InventoryBatchAvailability,
    "product_id" | "cost" | "available"
  >[];

  const totalInventoryValue = typedBatches.reduce(
    (sum, b) => sum + Math.max(0, b.available) * b.cost,
    0
  );

  const typedBalances = (balances ?? []) as Pick<
    Balance,
    "type" | "amount" | "category" | "name" | "notes" | "date"
  >[];

  // The beginning-balance deposit (name or notes containing "beginning") is
  // excluded from Cash — it seeds the Deposit to pay figure but isn't itself
  // counted as cash on hand. Other deposit entries count normally.
  const cashBalance = typedBalances.reduce((sum, b) => {
    const isBeginningDeposit =
      b.category === "deposit" &&
      ((b.name ?? "").toLowerCase().includes("beginning") ||
        (b.notes ?? "").toLowerCase().includes("beginning"));
    if (isBeginningDeposit) return sum;
    return sum + (b.type === "out" ? -b.amount : b.amount);
  }, 0);

  const depositToPay = typedBalances.reduce((sum, b) => {
    if (b.category === "deposit") return sum + b.amount;
    if (b.category === "withdrawal") return sum - b.amount;
    return sum;
  }, 0);

  const shopeeToSettle = (marketplaceBalances as MarketplaceBalances | null)?.shopee_to_settle ?? 0;
  const tokopediaToSettle =
    (marketplaceBalances as MarketplaceBalances | null)?.tokopedia_to_settle ?? 0;
  const totalValue = totalInventoryValue + shopeeToSettle + tokopediaToSettle + cashBalance;

  const batchCostById = new Map<string, number>();
  for (const b of (allBatches ?? []) as { id: string; cost: number }[]) {
    batchCostById.set(b.id, b.cost);
  }

  function isKnownCostLine(line: { inventory_batch_id: string | null }): boolean {
    return Boolean(line.inventory_batch_id) && batchCostById.get(line.inventory_batch_id!) !== undefined;
  }

  // Older order lines (from before the Strapi migration — see
  // scripts/migrate.ts) can have no linked inventory batch, so their cost
  // is unknown. Treating that as zero cost would understate cost and
  // inflate net/margin for any product with such lines (all-time revenue
  // stays exact since price is always known, but cost silently drops to 0
  // for the unlinked portion). Instead, estimate each unlinked line's cost
  // from that same product's own known cost ratio, computed across ALL of
  // its order lines regardless of the current month/category/channel
  // filters — a filtered window can easily contain zero known-cost lines to
  // base a ratio on (e.g. if only legacy unlinked sales fall in that month).
  const knownRevenueByProduct = new Map<string, number>();
  const knownCostByProduct = new Map<string, number>();
  for (const line of orderLines) {
    if (!isKnownCostLine(line)) continue;
    const cost = batchCostById.get(line.inventory_batch_id!)!;
    knownRevenueByProduct.set(
      line.product_id,
      (knownRevenueByProduct.get(line.product_id) ?? 0) + (line.price ?? 0)
    );
    knownCostByProduct.set(line.product_id, (knownCostByProduct.get(line.product_id) ?? 0) + cost);
  }

  function lineCost(line: OrderLineRow): number {
    if (isKnownCostLine(line)) return batchCostById.get(line.inventory_batch_id!)!;
    const knownRevenue = knownRevenueByProduct.get(line.product_id) ?? 0;
    const knownCost = knownCostByProduct.get(line.product_id) ?? 0;
    // No known-cost line at all for this product to base a ratio on —
    // assume 0% margin (cost = price) rather than pretending it was free.
    const ratio = knownRevenue > 0 ? knownCost / knownRevenue : 1;
    return (line.price ?? 0) * ratio;
  }

  const typedProducts = (products ?? []) as { id: string; name: string; tags: string[] }[];

  const salesByProduct = new Map<string, ProductSales>();
  const productTagsById = new Map<string, string[]>();
  for (const p of typedProducts) {
    salesByProduct.set(p.id, {
      productId: p.id,
      name: p.name,
      soldQty: 0,
      revenue: 0,
      cost: 0,
    });
    productTagsById.set(p.id, p.tags ?? []);
  }

  const ordersById = new Map<string, { channel: string | null; date: string | null }>();
  for (const o of orders) {
    ordersById.set(o.id, { channel: o.channel, date: o.date });
  }

  const availableMonths = [
    ...new Set(orders.map((o) => (o.date ?? "").slice(0, 7)).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a));

  const monthChannelFilteredLines = orderLines.filter((line) => {
    const order = ordersById.get(line.order_id);
    if (!order) return false;
    if (monthFilter && (order.date ?? "").slice(0, 7) !== monthFilter) return false;
    if (channelFilter && order.channel !== channelFilter) return false;
    return true;
  });

  const soldByCategory = {
    booster_box: 0,
    graded: 0,
    etb: 0,
    special_box: 0,
    accessories: 0,
    other: 0,
  };
  for (const line of monthChannelFilteredLines) {
    const tags = productTagsById.get(line.product_id) ?? [];
    const name = salesByProduct.get(line.product_id)?.name ?? "";
    soldByCategory[classifyProduct(tags, name)] += 1;
  }
  const filteredOrderCount = new Set(monthChannelFilteredLines.map((l) => l.order_id)).size;

  const catFilteredLines = catFilter
    ? monthChannelFilteredLines.filter((line) => {
        const tags = productTagsById.get(line.product_id) ?? [];
        const name = salesByProduct.get(line.product_id)?.name ?? "";
        return classifyProduct(tags, name) === catFilter;
      })
    : monthChannelFilteredLines;

  const filteredRevenue = catFilteredLines.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const filteredCost = catFilteredLines.reduce((sum, l) => sum + lineCost(l), 0);

  const filteredExpenses = typedBalances
    .filter((b) => b.category === "expenses" && (!monthFilter || b.date.slice(0, 7) === monthFilter))
    .reduce((sum, b) => sum + b.amount, 0);

  const filteredNet = filteredRevenue - filteredCost - filteredExpenses;
  const filteredMargin = filteredRevenue > 0 ? (filteredNet / filteredRevenue) * 100 : 0;

  // Sales table reflects the same month/category/channel filters as Line 1/2 above.
  for (const line of catFilteredLines) {
    const entry = salesByProduct.get(line.product_id);
    if (!entry) continue;
    entry.soldQty += 1;
    entry.revenue += line.price ?? 0;
    entry.cost += lineCost(line);
  }

  const sales = [...salesByProduct.values()]
    .filter((s) => s.soldQty > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const pagedSales = sales.slice((page - 1) * SALES_PAGE_SIZE, page * SALES_PAGE_SIZE);

  const inventoryByProduct = new Map<string, { available: number; totalValue: number }>();
  for (const b of typedBatches) {
    const entry = inventoryByProduct.get(b.product_id) ?? { available: 0, totalValue: 0 };
    const available = Math.max(0, b.available);
    entry.available += available;
    entry.totalValue += available * b.cost;
    inventoryByProduct.set(b.product_id, entry);
  }

  const valueByTag = {
    booster_box: { value: 0, pieces: 0 },
    etb: { value: 0, pieces: 0 },
    graded: { value: 0, pieces: 0 },
    special_box: { value: 0, pieces: 0 },
    single: { value: 0, pieces: 0 },
  };
  for (const [productId, v] of inventoryByProduct.entries()) {
    const tags = productTagsById.get(productId) ?? [];
    if (tags.includes("booster_box")) {
      valueByTag.booster_box.value += v.totalValue;
      valueByTag.booster_box.pieces += v.available;
    }
    if (tags.includes("etb")) {
      valueByTag.etb.value += v.totalValue;
      valueByTag.etb.pieces += v.available;
    }
    if (tags.includes("graded")) {
      valueByTag.graded.value += v.totalValue;
      valueByTag.graded.pieces += v.available;
    }
    if (tags.includes("special_box")) {
      valueByTag.special_box.value += v.totalValue;
      valueByTag.special_box.pieces += v.available;
    }
    if (tags.includes("single") || tags.includes("singles")) {
      valueByTag.single.value += v.totalValue;
      valueByTag.single.pieces += v.available;
    }
  }

  const inventory: ProductInventory[] = [...inventoryByProduct.entries()]
    .map(([productId, v]) => ({
      productId,
      name: salesByProduct.get(productId)?.name ?? "",
      available: v.available,
      totalValue: v.totalValue,
      net: (() => {
        const s = salesByProduct.get(productId);
        return s ? s.revenue - s.cost : 0;
      })(),
    }))
    .filter((i) => i.available > 0)
    .sort((a, b) => b.totalValue - a.totalValue);
  const pagedInventory = inventory.slice(
    (invPage - 1) * INVENTORY_PAGE_SIZE,
    invPage * INVENTORY_PAGE_SIZE
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Total inventory value</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(totalInventoryValue)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Cash</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(cashBalance)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Deposit to pay</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(depositToPay)}</div>
        </div>
        <div className="sm:col-span-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="mt-1 mb-3 text-2xl font-semibold">{formatMoney(totalValue)}</div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Cash</span>
              <span>{formatMoney(cashBalance)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Inventory</span>
              <span>{formatMoney(totalInventoryValue)}</span>
            </div>
            <MarketplaceBalanceForm
              shopeeToSettle={shopeeToSettle}
              tokopediaToSettle={tokopediaToSettle}
              totalValue={totalValue}
              depositToPay={depositToPay}
            />
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Value by category</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Booster Box</span>
                <span>
                  {formatMoney(valueByTag.booster_box.value)}
                  <span className="ml-2 text-gray-400">({valueByTag.booster_box.pieces})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Elite Trainer Box</span>
                <span>
                  {formatMoney(valueByTag.etb.value)}
                  <span className="ml-2 text-gray-400">({valueByTag.etb.pieces})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Graded Cards</span>
                <span>
                  {formatMoney(valueByTag.graded.value)}
                  <span className="ml-2 text-gray-400">({valueByTag.graded.pieces})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Special Boxes</span>
                <span>
                  {formatMoney(valueByTag.special_box.value)}
                  <span className="ml-2 text-gray-400">({valueByTag.special_box.pieces})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Single</span>
                <span>
                  {formatMoney(valueByTag.single.value)}
                  <span className="ml-2 text-gray-400">({valueByTag.single.pieces})</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 text-sm font-medium text-gray-500">
          Filter by month, category, channels
        </div>
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="month" className="text-xs text-gray-500">
              Month
            </label>
            <select
              id="month"
              name="month"
              defaultValue={monthFilter ?? ""}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="">All time</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cat" className="text-xs text-gray-500">
              Category
            </label>
            <select
              id="cat"
              name="cat"
              defaultValue={catFilter ?? ""}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="">All categories</option>
              {SOLD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="channel" className="text-xs text-gray-500">
              Channel
            </label>
            <select
              id="channel"
              name="channel"
              defaultValue={channelFilter ?? ""}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="">All channels</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded bg-black px-3 py-1.5 text-sm text-white"
          >
            Apply
          </button>
        </form>

        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Expenses</div>
            <div className="mt-1 text-xl font-semibold">{formatMoney(filteredExpenses)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Revenue</div>
            <div className="mt-1 text-xl font-semibold">{formatMoney(filteredRevenue)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Net</div>
            <div className="mt-1 text-xl font-semibold">{formatMoney(filteredNet)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Margin</div>
            <div className="mt-1 text-xl font-semibold">{filteredMargin.toFixed(1)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Booster box</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.booster_box}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Graded Cards</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.graded}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">ETB</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.etb}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Special Boxes</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.special_box}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Accessories</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.accessories}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Other</div>
            <div className="mt-1 text-xl font-semibold">{soldByCategory.other}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">Order count</div>
            <div className="mt-1 text-xl font-semibold">{filteredOrderCount}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Sales</h2>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium text-right">Sold qty</th>
                  <th className="px-4 py-2 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2 font-medium text-right">Cost</th>
                  <th className="px-4 py-2 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedSales.map((s) => (
                  <tr key={s.productId}>
                    <td className="px-4 py-2">
                      <Link href={`/zlap-adm/products/${s.productId}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{s.soldQty}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(s.revenue)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(s.cost)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(s.revenue - s.cost)}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      No sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={SALES_PAGE_SIZE}
            totalCount={sales.length}
            basePath="/zlap-adm/dashboard"
            extraParams={{ invPage: String(invPage) }}
          />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Inventory</h2>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="max-w-50 px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium text-right">Inventory</th>
                  <th className="px-4 py-2 font-medium text-right">Total value</th>
                  <th className="px-4 py-2 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedInventory.map((i) => (
                  <tr key={i.productId}>
                    <td className="max-w-50 truncate px-4 py-2">
                      <Link href={`/zlap-adm/products/${i.productId}`} className="hover:underline">
                        {i.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{i.available}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(i.totalValue)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(i.net)}</td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                      No inventory yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={invPage}
            pageSize={INVENTORY_PAGE_SIZE}
            totalCount={inventory.length}
            basePath="/zlap-adm/dashboard"
            paramName="invPage"
            extraParams={{ page: String(page) }}
          />
        </div>
      </div>
    </div>
  );
}
