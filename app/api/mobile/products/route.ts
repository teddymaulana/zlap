import { NextResponse } from "next/server";
import { searchStorefrontProducts, getRecommendedProducts } from "@/app/actions/storefront";

// Product browsing for the iOS app (zlap-mobile) — reuses the same
// storefront pricing/discount logic as the website's server components
// instead of letting the app query Supabase directly, since price
// computation needs the service-role batch/discount lookup that RLS
// deliberately keeps off the public anon key (see priceByProductId in
// app/actions/storefront.ts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const products = q ? await searchStorefrontProducts(q) : await getRecommendedProducts(24);
  return NextResponse.json({ products });
}
