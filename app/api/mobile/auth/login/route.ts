import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyPassword, createCustomerSession } from "@/lib/customerAuth";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mirrors app/actions/customer.ts's signInCustomer, but for the mobile app:
// same customers/customer_sessions tables, just hands the session id back
// as a token instead of only setting a cookie (see createCustomerSession).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, email, name, phone, password_hash")
    .eq("email", email)
    .maybeSingle();
  // password_hash is null for a Google-only account (set up on the web
  // storefront — see continueWithGoogle in app/actions/customer.ts) since
  // mobile has no Google sign-in yet; guard before verifyPassword rather
  // than letting it throw on a null stored hash.
  if (!customer || !customer.password_hash || !verifyPassword(password, customer.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await createCustomerSession(customer.id);
  return NextResponse.json({
    token,
    customer: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone },
  });
}
