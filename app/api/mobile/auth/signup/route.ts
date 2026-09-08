import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { hashPassword, createCustomerSession } from "@/lib/customerAuth";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mirrors app/actions/customer.ts's signUpCustomer — see login/route.ts for
// why this hands back a token instead of only a cookie.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const service = serviceClient();
  const { data: existing } = await service
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const { data: customer, error } = await service
    .from("customers")
    .insert({ email, password_hash: hashPassword(password), name, phone: phone || null })
    .select("id, email, name, phone")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const token = await createCustomerSession(customer.id);
  return NextResponse.json({ token, customer });
}
