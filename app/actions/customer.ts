"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  hashPassword,
  verifyPassword,
  createCustomerSession,
  destroyCustomerSession,
  getCurrentCustomerId,
} from "@/lib/customerAuth";

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
  const address = String(formData.get("address") ?? "").trim();

  if (!email || !password || !name) return { error: "Name, email, and password are required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const service = serviceClient();
  const { data: existing } = await service
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "An account with this email already exists" };

  const { data: customer, error } = await service
    .from("customers")
    .insert({
      email,
      password_hash: hashPassword(password),
      name,
      phone: phone || null,
      address: address || null,
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

export type CustomerProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
};

export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;

  const { data } = await serviceClient()
    .from("customers")
    .select("id, email, name, phone, address")
    .eq("id", customerId)
    .maybeSingle();
  return data;
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

export async function getCustomerOrderDetail(orderId: string): Promise<CustomerOrderDetail | null> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;

  const service = serviceClient();
  const { data: order } = await service.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.customer_id !== customerId) return null;

  const { data: rawLines, error } = await service
    .from("order_lines")
    .select("product_id, price, products(name, image_url)")
    .eq("order_id", orderId);
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
    order_id: order.order_id,
    date: order.date,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_details: order.payment_details,
    awb: order.awb,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_address: order.customer_address,
    cancellation_requested_at: order.cancellation_requested_at,
    cancellation_reason: order.cancellation_reason,
    lines,
    total,
  };
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

  revalidatePath("/store/account");
  revalidatePath(`/orders/${orderId}`);
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
    revalidatePath("/store/account");
    return { wishlisted: false };
  }

  await service.from("wishlist_items").insert({ customer_id: customerId, product_id: productId });
  revalidatePath("/store/account");
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
