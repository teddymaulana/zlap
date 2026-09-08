import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCustomerIdForToken } from "@/lib/customerAuth";
import { getBearerToken } from "@/lib/mobileAuth";

export async function GET(request: Request) {
  const customerId = await getCustomerIdForToken(getBearerToken(request));
  if (!customerId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: customer } = await service
    .from("customers")
    .select("id, email, name, phone, email_verified_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json({ customer });
}
