import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { refreshAllPoPriceSnapshots } from "@/lib/preorderPricing";

// Every-3-days refresh of the saved pre-order / out-of-stock slab prices (see
// refreshAllPoPriceSnapshots in lib/preorderPricing.ts). Scheduled in
// vercel.json; any scheduler works as long as it sends
// `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this automatically
// when CRON_SECRET is set).
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
  const result = await refreshAllPoPriceSnapshots(service);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });

  if (result.failed.length > 0) console.error("[preorder-prices] failed:", result.failed);
  return NextResponse.json(result);
}
