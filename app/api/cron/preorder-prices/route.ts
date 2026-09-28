import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PO_PRODUCT_COLUMNS, refreshPoPriceSnapshot } from "@/lib/preorderPricing";
import { isSlabProduct } from "@/lib/productCategory";

// Daily refresh of every pre-order-enabled product's saved price (see
// lib/preorderPricing.ts), plus every storefront PSA 10 slab listed out of
// stock via show_when_oos with a SNKRDUNK link — the storefront shows that
// saved price on them, display only (StorefrontProduct.marketPrice).
// Scheduled in vercel.json; any scheduler works as long as it sends
// `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this automatically
// when CRON_SECRET is set).
//
// Products are refreshed one at a time with a pause in between — a handful
// of requests a day, spaced out, rather than a burst at SNKRDUNK.
const PAUSE_BETWEEN_PRODUCTS_MS = 1500;

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: candidates, error } = await service
    .from("products")
    .select(`${PO_PRODUCT_COLUMNS}, po_enabled, name, tags`)
    .or("po_enabled.eq.true,and(storefront_enabled.eq.true,show_when_oos.eq.true,snkrdunk_url.not.is.null)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const products = (candidates ?? []).filter((p) => p.po_enabled || isSlabProduct(p));

  const results: { id: string; price?: number; error?: string }[] = [];
  for (const [i, product] of products.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_PRODUCTS_MS));
    const result = await refreshPoPriceSnapshot(service, product);
    results.push({ id: product.id, ...result });
  }

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) console.error("[preorder-prices] failed:", failed);
  return NextResponse.json({ refreshed: results.length - failed.length, failed });
}
