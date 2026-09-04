"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  hashPassword,
  verifyPassword,
  createCustomerSession,
  destroyCustomerSession,
  getCurrentCustomerId,
} from "@/lib/customerAuth";
import { getProductsForReorder } from "@/app/actions/storefront";
import { sendPasswordResetEmail } from "@/lib/email";

const SITE_URL = "https://zlapcard.com";
const RESET_TOKEN_TTL_HOURS = 1;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function signUpCustomer(formData: FormData): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!email || !password || !name) return { error: "Name, email, and password are required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const service = serviceClient();
  const { data: existing } = await service
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "An account with this email already exists" };

  // Deliberately not collecting a shipping address here — see the note on
  // CustomerProfile below. Each order still captures its own address at
  // checkout time.
  const { data: customer, error } = await service
    .from("customers")
    .insert({
      email,
      password_hash: hashPassword(password),
      name,
      phone: phone || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await createCustomerSession(customer.id);
  return { error: null };
}

export async function signInCustomer(formData: FormData): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required" };

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (!customer || !verifyPassword(password, customer.password_hash)) {
    return { error: "Incorrect email or password" };
  }

  await createCustomerSession(customer.id);
  return { error: null };
}

export async function signOutCustomer() {
  await destroyCustomerSession();
}

// Always returns success regardless of whether the email matches an account,
// so this can't be used to enumerate registered emails — only actually sends
// when it does.
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { error: "Email is required" };

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (customer) {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await service
      .from("customers")
      .update({ reset_token: token, reset_token_expires_at: expiresAt })
      .eq("id", customer.id);

    await sendPasswordResetEmail({
      to: normalizedEmail,
      resetUrl: `${SITE_URL}/account/reset-password?token=${token}`,
      expiresAt,
    });
  }

  return {};
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ error: string | null }> {
  if (!token) return { error: "This reset link is invalid" };
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, reset_token_expires_at")
    .eq("reset_token", token)
    .maybeSingle();
  if (!customer) return { error: "This reset link is invalid or has already been used" };
  if (!customer.reset_token_expires_at || new Date(customer.reset_token_expires_at) < new Date()) {
    return { error: "This reset link has expired — request a new one" };
  }

  const { error } = await service
    .from("customers")
    .update({
      password_hash: hashPassword(newPassword),
      reset_token: null,
      reset_token_expires_at: null,
    })
    .eq("id", customer.id);
  if (error) return { error: error.message };

  await createCustomerSession(customer.id);
  return { error: null };
}

// No address field on purpose: as a small shop we'd rather not hold onto
// customers' home addresses beyond what each order itself already needs —
// see customer_address on the orders table, captured fresh at checkout.
export type CustomerProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;

  const { data } = await serviceClient()
    .from("customers")
    .select("id, email, name, phone")
    .eq("id", customerId)
    .maybeSingle();
  return data;
}

export async function updateCustomerProfile(params: {
  name: string;
  phone: string;
  email: string;
}): Promise<{ error: string | null }> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return { error: "You need to be signed in" };

  const name = params.name.trim();
  const phone = params.phone.trim();
  const email = params.email.trim().toLowerCase();
  if (!name) return { error: "Name is required" };
  if (!email) return { error: "Email is required" };

  const service = serviceClient();
  const { data: existing } = await service
    .from("customers")
    .select("id")
    .eq("email", email)
    .neq("id", customerId)
    .maybeSingle();
  if (existing) return { error: "Another account already uses this email" };

  const { error } = await service
    .from("customers")
    .update({ name, phone: phone || null, email })
    .eq("id", customerId);
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { error: null };
}

export async function updateCustomerPassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ error: string | null }> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return { error: "You need to be signed in" };
  if (params.newPassword.length < 8) return { error: "New password must be at least 8 characters" };

  const service = serviceClient();
  const { data: customer } = await service
    .from("customers")
    .select("password_hash")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer || !verifyPassword(params.currentPassword, customer.password_hash)) {
    return { error: "Current password is incorrect" };
  }

  const { error } = await service
    .from("customers")
    .update({ password_hash: hashPassword(params.newPassword) })
    .eq("id", customerId);
  if (error) return { error: error.message };

  return { error: null };
}

export type CustomerOrder = {
  id: string;
  order_id: string;
  date: string | null;
  status: "pending" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refund_pending" | "refunded";
  cancellation_requested_at: string | null;
};

export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return [];

  const { data, error } = await serviceClient()
    .from("orders")
    .select("id, order_id, date, status, payment_status, cancellation_requested_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CustomerOrderLine = {
  product_id: string;
  name: string;
  image_url: string | null;
  price: number;
  qty: number;
};

export type CustomerOrderDetail = {
  id: string;
  order_id: string;
  date: string | null;
  status: "pending" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refund_pending" | "refunded";
  payment_method: string | null;
  payment_details: {
    va_number?: string;
    bank?: string;
    qr_url?: string;
    qr_expiry?: string;
    deeplink_url?: string;
    payment_code?: string;
    store?: string;
  } | null;
  awb: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  lines: CustomerOrderLine[];
  total: number;
};

async function loadOrderDetail(
  service: ReturnType<typeof serviceClient>,
  order: { id: string; [key: string]: unknown }
): Promise<CustomerOrderDetail> {
  const { data: rawLines, error } = await service
    .from("order_lines")
    .select("product_id, price, products(name, image_url)")
    .eq("order_id", order.id);
  if (error) throw new Error(error.message);

  const grouped = new Map<string, CustomerOrderLine>();
  for (const l of rawLines ?? []) {
    // Embedded to-one relations come back as a plain object at runtime
    // despite the default array typing.
    const product = l.products as unknown as { name: string; image_url: string | null } | null;
    const existing = grouped.get(l.product_id);
    if (existing) {
      existing.qty += 1;
    } else {
      grouped.set(l.product_id, {
        product_id: l.product_id,
        name: product?.name ?? "Unknown product",
        image_url: product?.image_url ?? null,
        price: l.price ?? 0,
        qty: 1,
      });
    }
  }

  const lines = [...grouped.values()];
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  return {
    id: order.id,
    order_id: order.order_id as string,
    date: order.date as string | null,
    status: order.status as CustomerOrderDetail["status"],
    payment_status: order.payment_status as CustomerOrderDetail["payment_status"],
    payment_method: order.payment_method as string | null,
    payment_details: order.payment_details as CustomerOrderDetail["payment_details"],
    awb: order.awb as string | null,
    customer_name: order.customer_name as string | null,
    customer_phone: order.customer_phone as string | null,
    customer_address: order.customer_address as string | null,
    cancellation_requested_at: order.cancellation_requested_at as string | null,
    cancellation_reason: order.cancellation_reason as string | null,
    lines,
    total,
  };
}

export async function getCustomerOrderDetail(orderId: string): Promise<CustomerOrderDetail | null> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;

  const service = serviceClient();
  const { data: order } = await service.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.customer_id !== customerId) return null;

  return loadOrderDetail(service, order);
}

// Public lookup for guest checkouts, which have no account to sign into.
// Gated by order code + the email used at checkout (not by session), since
// a guest has no other credential to prove they own the order.
export async function getGuestOrderDetail(
  orderCode: string,
  email: string
): Promise<CustomerOrderDetail | null> {
  const trimmedCode = orderCode.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!trimmedCode || !normalizedEmail) return null;

  const service = serviceClient();
  const { data: order } = await service
    .from("orders")
    .select("*")
    .eq("order_id", trimmedCode)
    .maybeSingle();
  if (!order || !order.customer_email || order.customer_email.toLowerCase() !== normalizedEmail) {
    return null;
  }

  return loadOrderDetail(service, order);
}

export async function requestOrderCancellation(
  orderId: string,
  reason: string
): Promise<{ error?: string }> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return { error: "You need to be signed in" };

  const service = serviceClient();
  const { data: order } = await service
    .from("orders")
    .select("id, customer_id, status, cancellation_requested_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.customer_id !== customerId) return { error: "Order not found" };
  if (order.status !== "pending") return { error: "This order can no longer be cancelled" };
  if (order.cancellation_requested_at) return { error: "Cancellation already requested" };

  const { error } = await service
    .from("orders")
    .update({ cancellation_requested_at: new Date().toISOString(), cancellation_reason: reason.trim() || null })
    .eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath(`/zlap-adm/orders/${orderId}`);
  return {};
}

export async function toggleWishlist(
  productId: string
): Promise<{ error?: string; wishlisted?: boolean }> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return { error: "not_signed_in" };

  const service = serviceClient();
  const { data: existing } = await service
    .from("wishlist_items")
    .select("id")
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await service.from("wishlist_items").delete().eq("id", existing.id);
    revalidatePath("/account");
    return { wishlisted: false };
  }

  await service.from("wishlist_items").insert({ customer_id: customerId, product_id: productId });
  revalidatePath("/account");
  return { wishlisted: true };
}

export async function getWishlistProductIds(): Promise<string[]> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return [];

  const { data } = await serviceClient()
    .from("wishlist_items")
    .select("product_id")
    .eq("customer_id", customerId);
  return (data ?? []).map((r) => r.product_id);
}

export type ReorderItem = {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  price: number;
};

// "Buy again" — re-derives cart-ready items from a past order at *current*
// price/availability rather than replaying the historical order price, same
// principle as createOrderAndCharge never trusting a client-sent price.
export async function getReorderItems(
  orderId: string
): Promise<{ items: ReorderItem[]; qtyByProductId: Record<string, number>; unavailable: string[] } | null> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;

  const service = serviceClient();
  const { data: order } = await service
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.customer_id !== customerId) return null;

  const { data: rawLines } = await service.from("order_lines").select("product_id").eq("order_id", orderId);
  const qtyByProductId: Record<string, number> = {};
  for (const l of rawLines ?? []) {
    qtyByProductId[l.product_id] = (qtyByProductId[l.product_id] ?? 0) + 1;
  }

  const productIds = Object.keys(qtyByProductId);
  const products = await getProductsForReorder(productIds);
  const foundIds = new Set(products.map((p) => p.id));

  const items: ReorderItem[] = [];
  const unavailable: string[] = [];
  for (const p of products) {
    if (p.price === null) unavailable.push(p.name);
    else items.push({ productId: p.id, name: p.name, sku: p.sku, imageUrl: p.image_url, price: p.price });
  }
  // A product removed from the catalog entirely won't come back from
  // getProductsForReorder at all — count it unavailable too, just unnamed.
  const missingCount = productIds.filter((id) => !foundIds.has(id)).length;
  for (let i = 0; i < missingCount; i++) unavailable.push("An item from this order");

  return { items, qtyByProductId, unavailable };
}
