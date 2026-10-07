import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendAbandonedCartEmail } from "@/lib/email";
import type { CartItem } from "@/app/(storefront)/CartContext";

// Daily abandoned-cart reminder (scheduled in vercel.json for 12:00 UTC =
// 19:00 WIB — an evening nudge). Emails signed-in customers whose cart has
// sat untouched for at least IDLE_HOURS, at most once per cart contents and
// at most once a week per customer. Does nothing unless
// storefront_settings.abandoned_cart_emails is switched on in
// /zlap-adm/storefront. Same CRON_SECRET auth as the pre-order price cron.
export const maxDuration = 300;

// With a once-a-day run, a cart left anywhere from 12 to 36 hours ago gets
// its reminder — in practice "the next evening".
const IDLE_HOURS = 12;
// Carts older than this are stale — don't dig them up.
const MAX_AGE_DAYS = 7;
const CUSTOMER_COOLDOWN_DAYS = 7;
const MAX_EMAILS_PER_RUN = 200;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: settings } = await service
    .from("storefront_settings")
    .select("abandoned_cart_emails")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.abandoned_cart_emails !== true) {
    return NextResponse.json({ skipped: "abandoned cart emails are off" });
  }

  const { data: carts, error } = await service
    .from("carts")
    .select("id, customer_id, items, updated_at")
    .not("customer_id", "is", null)
    .is("converted_at", null)
    .is("reminder_sent_at", null)
    .gt("item_count", 0)
    .lt("updated_at", hoursAgo(IDLE_HOURS))
    .gt("updated_at", hoursAgo(MAX_AGE_DAYS * 24))
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!carts || carts.length === 0) return NextResponse.json({ sent: 0 });

  const customerIds = [...new Set(carts.map((c) => c.customer_id as string))];
  const [{ data: customers }, { data: recentlyReminded }, { data: recentOrders }] = await Promise.all([
    service.from("customers").select("id, email, name, cart_reminders_opt_out").in("id", customerIds),
    service
      .from("carts")
      .select("customer_id")
      .in("customer_id", customerIds)
      .gt("reminder_sent_at", hoursAgo(CUSTOMER_COOLDOWN_DAYS * 24)),
    service
      .from("orders")
      .select("customer_id, created_at")
      .in("customer_id", customerIds)
      .gt("created_at", hoursAgo(MAX_AGE_DAYS * 24)),
  ]);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const remindedCustomers = new Set((recentlyReminded ?? []).map((r) => r.customer_id));

  let sent = 0;
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);

  for (const cart of carts) {
    if (sent >= MAX_EMAILS_PER_RUN) break;
    const customer = customerById.get(cart.customer_id);
    if (!customer?.email) {
      skip("no email");
      continue;
    }
    if (customer.cart_reminders_opt_out) {
      skip("unsubscribed");
      continue;
    }
    // Covers several carts for one customer (different devices) too.
    if (remindedCustomers.has(customer.id)) {
      skip("reminded recently");
      continue;
    }
    // Ordered since last touching this cart (maybe from another device).
    if ((recentOrders ?? []).some((o) => o.customer_id === customer.id && o.created_at > cart.updated_at)) {
      skip("ordered since");
      continue;
    }

    const lines = (cart.items as CartItem[]).map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      imageUrl: i.image_url,
    }));
    const ok = await sendAbandonedCartEmail({
      to: customer.email,
      customerName: customer.name,
      cartId: cart.id,
      lines,
    });
    if (!ok) {
      skip("send failed");
      continue;
    }
    await service.from("carts").update({ reminder_sent_at: new Date().toISOString() }).eq("id", cart.id);
    remindedCustomers.add(customer.id);
    sent++;
  }

  return NextResponse.json({ sent, skipped });
}
