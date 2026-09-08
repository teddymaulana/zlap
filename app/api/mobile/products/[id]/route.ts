import { NextResponse } from "next/server";
import { getStorefrontProductDetail } from "@/app/actions/storefront";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getStorefrontProductDetail(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}
