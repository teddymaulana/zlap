import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mirrors app/actions/customer.ts's verifyEmailWithToken — for a mobile app
// that wants to handle the verification link itself (deep link) instead of
// opening /account/verify-email in a browser. No auth required: the token
// itself is the proof, same as the web page.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  if (!token) return NextResponse.json({ error: "This verification link is invalid" }, { status: 400 });

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, email_verified_at, verification_token_expires_at")
    .eq("verification_token", token)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json(
      { error: "This verification link is invalid or has already been used" },
      { status: 400 }
    );
  }
  if (customer.email_verified_at) return NextResponse.json({ ok: true }); // already verified
  if (
    !customer.verification_token_expires_at ||
    new Date(customer.verification_token_expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "This verification link has expired — request a new one" },
      { status: 400 }
    );
  }

  const { error } = await service
    .from("customers")
    .update({
      email_verified_at: new Date().toISOString(),
      verification_token: null,
      verification_token_expires_at: null,
    })
    .eq("id", customer.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
