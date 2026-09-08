import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCustomerIdForToken } from "@/lib/customerAuth";
import { getBearerToken } from "@/lib/mobileAuth";

// Mirrors app/actions/customer.ts's toggleWishlist, reading the customer
// from a Bearer token instead of the web session cookie.
export async function POST(request: Request) {
  const customerId = await getCustomerIdForToken(getBearerToken(request));
  if (!customerId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: existing } = await service
    .from("wishlist_items")
    .select("id")
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await service.from("wishlist_items").delete().eq("id", existing.id);
    return NextResponse.json({ wishlisted: false });
  }

  await service.from("wishlist_items").insert({ customer_id: customerId, product_id: productId });
  return NextResponse.json({ wishlisted: true });
}
