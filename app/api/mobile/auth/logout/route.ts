import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getBearerToken } from "@/lib/mobileAuth";

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (token) {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await service.from("customer_sessions").delete().eq("id", token);
  }
  return NextResponse.json({ ok: true });
}
