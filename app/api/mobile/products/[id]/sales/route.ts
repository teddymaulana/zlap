import { NextResponse } from "next/server";
import { getStorefrontProductRecentSales } from "@/app/actions/storefront";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sales = await getStorefrontProductRecentSales(id);
  return NextResponse.json({ sales });
}
