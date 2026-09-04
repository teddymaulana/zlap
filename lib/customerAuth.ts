import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Storefront customer sessions are a lightweight, separate system from
// Supabase Auth (see the comment on the `customers` table in schema.sql) —
// this cookie only ever gets looked up server-side via the service role,
// never turned into a Supabase session.
const SESSION_COOKIE = "customer_session";
const SESSION_DAYS = 30;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const suppliedBuffer = scryptSync(password, salt, 64);
  if (hashBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(hashBuffer, suppliedBuffer);
}

export async function createCustomerSession(customerId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await serviceClient()
    .from("customer_sessions")
    .insert({ customer_id: customerId, expires_at: expiresAt.toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function destroyCustomerSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await serviceClient().from("customer_sessions").delete().eq("id", sessionId);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentCustomerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { data } = await serviceClient()
    .from("customer_sessions")
    .select("customer_id, expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.customer_id;
}
