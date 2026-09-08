import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCustomerIdForToken } from "@/lib/customerAuth";
import { getBearerToken } from "@/lib/mobileAuth";
import { sendVerificationEmail } from "@/lib/email";

const SITE_URL = "https://zlapcard.com";
const VERIFY_TOKEN_TTL_HOURS = 48;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mirrors app/actions/customer.ts's resendVerificationEmail.
export async function POST(request: Request) {
  const customerId = await getCustomerIdForToken(getBearerToken(request));
  if (!customerId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("email, email_verified_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (customer.email_verified_at) return NextResponse.json({ ok: true }); // already verified

  const verificationToken = randomBytes(24).toString("hex");
  const verificationTokenExpiresAt = new Date(
    Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { error } = await service
    .from("customers")
    .update({
      verification_token: verificationToken,
      verification_token_expires_at: verificationTokenExpiresAt,
    })
    .eq("id", customerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendVerificationEmail({
    to: customer.email,
    verifyUrl: `${SITE_URL}/account/verify-email?token=${verificationToken}`,
  });
  return NextResponse.json({ ok: true });
}
