import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCustomerIdForToken } from "@/lib/customerAuth";
import { getBearerToken } from "@/lib/mobileAuth";

// Mirrors app/actions/customer.ts's getWishlistProductIds, reading the
// customer from a Bearer token instead of the web session cookie.
export async function GET(request: Request) {
  const customerId = await getCustomerIdForToken(getBearerToken(request));
  if (!customerId) return NextResponse.json({ productIds: [] });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await service.from("wishlist_items").select("product_id").eq("customer_id", customerId);
  return NextResponse.json({ productIds: (data ?? []).map((r) => r.product_id) });
}
