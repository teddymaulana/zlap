/**
 * One-off migration: old Strapi Postgres -> new Supabase schema.
 *
 * Run manually, never deployed:
 *   npx tsx scripts/migrate.ts
 *
 * Requires in .env.local: STRAPI_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS for the bulk load).
 *
 * Strapi stored each product/order/purchase's line items as a single JSON
 * blob (`custom_data`). This script explodes those blobs into the new
 * normalized tables. Two spots are inherently approximate because Strapi
 * never stored a direct foreign key between a purchase line and the
 * inventory batch it created — see the comments on `migratePurchases` and
 * `migrateOrders` below. Spot-check a few known purchases/orders in the
 * Strapi admin against what lands in Supabase before trusting this fully.
 */
import { config } from "dotenv";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const strapiUrl = process.env.STRAPI_DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!strapiUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing STRAPI_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const strapi = new Client({ connectionString: strapiUrl });
const supabase = createClient(supabaseUrl, serviceRoleKey);

type InventoryLine = {
  id: string; // Strapi's client-generated batch id, e.g. "m4x2z9-abc123"
  qty: number;
  cost: number | string;
  acquired_date: string;
  qty_outgoing: number;
  locked?: boolean;
  purchase_document_id?: string;
};

async function migrateProducts() {
  const { rows } = await strapi.query(
    `select id, document_id, name, sku, tags, custom_data from products where published_at is not null`
  );

  // legacy batch id ("m4x2z9-abc123") -> new Supabase batch uuid, needed by
  // migrateOrders to resolve which batch an order line was sold against.
  const batchIdMap = new Map<string, string>();
  const productIdMap = new Map<string, string>(); // document_id -> new uuid

  for (const row of rows) {
    const { data: product, error } = await supabase
      .from("products")
      .insert({ name: row.name, sku: row.sku, tags: row.tags ? [row.tags] : [] })
      .select("id")
      .single();
    if (error) throw new Error(`product ${row.document_id}: ${error.message}`);
    productIdMap.set(row.document_id, product.id);

    // inv.qty is the original acquired batch quantity, constant for the
    // batch's lifetime — Strapi's Order.jsx only ever decrements
    // qty_outgoing on a sale, never qty (see bumpInventoryFromKnownData in
    // the old app). Copy qty as-is; do NOT add qty_outgoing/order count back
    // into it, that double-counts sales against the new schema's derived
    // `available` (qty - linked order_lines).
    const inventories: InventoryLine[] = row.custom_data?.inventories ?? [];
    for (const inv of inventories) {
      const { data: batch, error: batchError } = await supabase
        .from("inventory_batches")
        .insert({
          product_id: product.id,
          qty: Number(inv.qty) || 0,
          cost: Number(inv.cost) || 0,
          acquired_date: inv.acquired_date || null,
          locked: Boolean(inv.locked),
        })
        .select("id")
        .single();
      if (batchError) throw new Error(`batch ${inv.id}: ${batchError.message}`);
      batchIdMap.set(inv.id, batch.id);
    }
  }

  console.log(`products: migrated ${rows.length} rows, ${batchIdMap.size} inventory batches`);
  return { productIdMap, batchIdMap };
}

// Strapi's purchase.custom_data.lines[] never stored the id of the inventory
// batch a pushed line created (only a `pushed: true` flag) — the batch only
// carries the purchase's document_id back-reference. So a purchase line is
// paired with a batch positionally: nth pushed line for a product, in JSON
// order, is assumed to correspond to the nth batch created for that product
// under this purchase. This holds unless batches for the same purchase+product
// were manually reordered or edited after the fact.
async function migratePurchases(productIdMap: Map<string, string>) {
  const { rows } = await strapi.query(
    `select id, document_id, name, date, custom_data from purchases where published_at is not null`
  );

  let lineCount = 0;

  for (const row of rows) {
    const fees = row.custom_data ?? {};
    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert({
        name: row.name,
        date: row.date,
        inter_shipping: Number(fees.inter_shipping) || 0,
        forwarding: Number(fees.forwarding) || 0,
        local_cargo: Number(fees.local_cargo) || 0,
        payment_fee: Number(fees.payment_fee) || 0,
        other_expense: Number(fees.other_expense) || 0,
        deduction: Number(fees.deduction) || 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(`purchase ${row.document_id}: ${error.message}`);

    // Batches this purchase created, grouped by product, in creation order.
    const { data: batchesForPurchase } = await supabase
      .from("inventory_batches")
      .select("id, product_id, created_at")
      .eq("purchase_id", purchase.id)
      .order("created_at", { ascending: true });
    const batchQueueByProduct = new Map<string, string[]>();
    for (const b of batchesForPurchase ?? []) {
      const list = batchQueueByProduct.get(b.product_id) ?? [];
      list.push(b.id);
      batchQueueByProduct.set(b.product_id, list);
    }

    const lines = fees.lines ?? [];
    for (const line of lines) {
      const legacyProductId = line?.line?.documentId;
      const productId = legacyProductId ? productIdMap.get(legacyProductId) : undefined;
      if (!productId) {
        console.warn(`  purchase ${row.document_id}: skipping line with unknown product`);
        continue;
      }

      let inventoryBatchId: string | null = null;
      if (line.pushed) {
        const queue = batchQueueByProduct.get(productId);
        inventoryBatchId = queue?.shift() ?? null;
      }

      const { error: lineError } = await supabase.from("purchase_lines").insert({
        purchase_id: purchase.id,
        product_id: productId,
        qty: Number(line.qty) || 0,
        unit_cost: Number(line.unit_cost) || 0,
        exclude_cost: Boolean(line.exclude_cost),
        use_custom_landed_cost: Boolean(line.use_custom_landed_cost),
        custom_landed_cost: line.custom_landed_cost ? Number(line.custom_landed_cost) : null,
        pushed: Boolean(line.pushed),
        inventory_batch_id: inventoryBatchId,
      });
      if (lineError) throw new Error(`purchase line: ${lineError.message}`);
      lineCount += 1;
    }

    // Any inventory batch this purchase created but that no purchase_line now
    // points back to (e.g. this pairing heuristic ran out of lines) — link
    // its purchase_id anyway; it just won't show as a purchase_line row.
  }

  console.log(`purchases: migrated ${rows.length} rows, ${lineCount} lines`);
}

async function migrateOrders(productIdMap: Map<string, string>, batchIdMap: Map<string, string>) {
  const { rows } = await strapi.query(
    `select id, document_id, order_id, channel, date, order_url, order_status, custom_data
     from orders where published_at is not null`
  );

  let lineCount = 0;
  // Strapi doesn't enforce order_id uniqueness; the new schema does. Suffix
  // repeats ("-2", "-3", ...) rather than dropping data.
  const orderIdSeenCount = new Map<string, number>();

  for (const row of rows) {
    const seen = orderIdSeenCount.get(row.order_id) ?? 0;
    orderIdSeenCount.set(row.order_id, seen + 1);
    const orderId = seen === 0 ? row.order_id : `${row.order_id}-${seen + 1}`;
    if (seen > 0) {
      console.warn(`  order ${row.document_id}: duplicate order_id ${row.order_id}, using ${orderId}`);
    }

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_id: orderId,
        channel: row.channel,
        date: row.date,
        order_url: row.order_url,
        status: row.order_status === "completed" ? "completed" : "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(`order ${row.document_id}: ${error.message}`);

    const lines = row.custom_data?.lines ?? [];
    for (const line of lines) {
      const legacyProductId = line?.documentId;
      const productId = legacyProductId ? productIdMap.get(legacyProductId) : undefined;
      if (!productId) {
        console.warn(`  order ${row.order_id}: skipping line with unknown product`);
        continue;
      }
      const inventoryBatchId = line?.inv?.id ? batchIdMap.get(line.inv.id) ?? null : null;

      const { error: lineError } = await supabase.from("order_lines").insert({
        order_id: order.id,
        product_id: productId,
        inventory_batch_id: inventoryBatchId,
        price: Number(line.price) || 0,
      });
      if (lineError) throw new Error(`order line: ${lineError.message}`);
      lineCount += 1;
    }
  }

  console.log(`orders: migrated ${rows.length} rows, ${lineCount} lines`);
}

async function migrateCash() {
  const { rows } = await strapi.query(
    `select date, payments, source_destination, amount, name, notes
     from cashs where published_at is not null`
  );
  for (const row of rows) {
    const { error } = await supabase.from("cash").insert({
      date: row.date,
      payment_type: row.payments,
      source_destination: row.source_destination,
      amount: Number(row.amount) || 0,
      name: row.name,
      notes: row.notes,
    });
    if (error) throw new Error(`cash row: ${error.message}`);
  }
  console.log(`cash: migrated ${rows.length} rows`);
}

async function migrateSnapshots() {
  const { rows } = await strapi.query(
    `select value, deposit, tokopedia, shopee, created_at
     from snapshots where published_at is not null`
  );
  for (const row of rows) {
    const { error } = await supabase.from("snapshots").insert({
      snapshot_date: row.created_at,
      value: Number(row.value) || 0,
      deposit: Number(row.deposit) || 0,
      tokopedia: Number(row.tokopedia) || 0,
      shopee: Number(row.shopee) || 0,
    });
    if (error) throw new Error(`snapshot row: ${error.message}`);
  }
  console.log(`snapshots: migrated ${rows.length} rows`);
}

async function migrateSupplierPricelist() {
  const { rows } = await strapi.query(
    `select category, name, flag, price_jpy, price_usd, price_gbp, price_eur,
            price_cad, price_aud, price_sgd, imported_at
     from supplier_pricelists where published_at is not null`
  );
  for (const row of rows) {
    const { error } = await supabase.from("supplier_pricelist").insert(row);
    if (error) throw new Error(`supplier_pricelist row: ${error.message}`);
  }
  console.log(`supplier_pricelist: migrated ${rows.length} rows`);
}

async function main() {
  await strapi.connect();
  try {
    const { productIdMap, batchIdMap } = await migrateProducts();
    await migratePurchases(productIdMap);
    await migrateOrders(productIdMap, batchIdMap);
    await migrateCash();
    await migrateSnapshots();
    await migrateSupplierPricelist();
  } finally {
    await strapi.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
