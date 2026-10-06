"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset } from "@/app/actions/customer";
import { PAGE_SIZE } from "@/lib/constants";
import type { Order } from "@/lib/types";

// The customers tables have no RLS policies (see the comment on `customers`
// in schema.sql), so everything here has to go through the service role —
// which makes the admin-session check below the only thing standing between
// these public server-action endpoints and every customer's account.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AdminCustomer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified_at: string | null;
  created_at: string;
  hasPassword: boolean;
};

export type AdminCustomerRow = AdminCustomer & { orderCount: number };

const CUSTOMER_COLUMNS = "id, email, name, phone, email_verified_at, created_at, password_hash";

function toAdminCustomer(row: Omit<AdminCustomer, "hasPassword"> & { password_hash: string | null }): AdminCustomer {
  // Never hand the hash itself to the page — only whether one exists
  // (null means a Google-only account).
  const { password_hash, ...rest } = row;
  return { ...rest, hasPassword: !!password_hash };
}

export async function getCustomers(
  page: number,
  query: string
): Promise<{ customers: AdminCustomerRow[]; totalCount: number }> {
  await requireAdmin();
  const service = serviceClient();

  const from = (page - 1) * PAGE_SIZE;
  let request = service
    .from("customers")
    .select(CUSTOMER_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const trimmed = query.trim();
  if (trimmed) {
    // Same escaping as the orders search — keeps commas/parens in the search
    // text from breaking PostgREST's or() mini-syntax.
    const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    request = request.or(
      [`email.ilike."%${escaped}%"`, `name.ilike."%${escaped}%"`, `phone.ilike."%${escaped}%"`].join(",")
    );
  }

  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { customers: [], totalCount: count ?? 0 };

  const { data: orders, error: ordersError } = await service
    .from("orders")
    .select("customer_id")
    .in(
      "customer_id",
      data.map((c) => c.id)
    );
  if (ordersError) throw new Error(ordersError.message);
  const orderCountById = new Map<string, number>();
  for (const o of orders ?? []) {
    orderCountById.set(o.customer_id, (orderCountById.get(o.customer_id) ?? 0) + 1);
  }

  return {
    customers: data.map((c) => ({ ...toAdminCustomer(c), orderCount: orderCountById.get(c.id) ?? 0 })),
    totalCount: count ?? 0,
  };
}

export async function getCustomer(id: string): Promise<{
  customer: AdminCustomer;
  orders: Order[];
  activeSessionCount: number;
  wishlistCount: number;
} | null> {
  await requireAdmin();
  const service = serviceClient();

  const { data: customer, error } = await service
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return null;

  const [{ data: orders, error: ordersError }, { count: activeSessionCount }, { count: wishlistCount }] =
    await Promise.all([
      service.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      service
        .from("customer_sessions")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id)
        .gt("expires_at", new Date().toISOString()),
      service.from("wishlist_items").select("id", { count: "exact", head: true }).eq("customer_id", id),
    ]);
  if (ordersError) throw new Error(ordersError.message);

  return {
    customer: toAdminCustomer(customer),
    orders: (orders ?? []) as Order[],
    activeSessionCount: activeSessionCount ?? 0,
    wishlistCount: wishlistCount ?? 0,
  };
}

export async function updateCustomer(id: string, formData: FormData): Promise<{ error: string | null }> {
  await requireAdmin();
  const service = serviceClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email || !name) return { error: "Name and email are required" };

  const { data: current } = await service.from("customers").select("email").eq("id", id).maybeSingle();
  if (!current) return { error: "Customer not found" };

  const update: Record<string, string | null> = { name, phone: phone || null };
  if (email !== current.email) {
    const { data: existing } = await service.from("customers").select("id").eq("email", email).maybeSingle();
    if (existing) return { error: "Another account already uses this email" };
    // A new address hasn't been confirmed by anyone — drop the old
    // verification rather than carry it over to an address it never covered.
    update.email = email;
    update.email_verified_at = null;
    update.verification_token = null;
    update.verification_token_expires_at = null;
  }

  const { error } = await service.from("customers").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/zlap-adm/customers");
  revalidatePath(`/zlap-adm/customers/${id}`);
  return { error: null };
}

export async function setCustomerEmailVerified(id: string, verified: boolean) {
  await requireAdmin();
  const { error } = await serviceClient()
    .from("customers")
    .update({
      email_verified_at: verified ? new Date().toISOString() : null,
      verification_token: null,
      verification_token_expires_at: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/customers");
  revalidatePath(`/zlap-adm/customers/${id}`);
}

// Same email the customer gets from "Forgot password" on the storefront —
// staff never see or set the password themselves.
export async function sendCustomerPasswordReset(id: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const { data: customer } = await serviceClient().from("customers").select("email").eq("id", id).maybeSingle();
  if (!customer) return { error: "Customer not found" };

  const result = await requestPasswordReset(customer.email);
  return { error: result.error ?? null };
}

export async function signOutCustomerEverywhere(id: string) {
  await requireAdmin();
  const { error } = await serviceClient().from("customer_sessions").delete().eq("customer_id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/zlap-adm/customers/${id}`);
}

// Sessions, wishlist and discount redemptions cascade; orders and offers keep
// their rows with customer_id set null (they still carry their own copy of
// the name/phone/address captured at checkout).
export async function deleteCustomer(id: string) {
  await requireAdmin();
  const { error } = await serviceClient().from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/customers");
  redirect("/zlap-adm/customers");
}
