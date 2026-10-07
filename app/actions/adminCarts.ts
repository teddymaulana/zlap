"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CartItem } from "@/app/(storefront)/CartContext";

// carts / cart_adds are service-role only (see schema.sql), so — same as
// adminCustomers.ts — the admin-session check is what guards these.
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

export type CartRange = "today" | "7d" | "30d";

// "Today" is the shop's day (WIB, UTC+7), not the server's.
function rangeStart(range: CartRange): string {
  const WIB_OFFSET_MS = 7 * 3600_000;
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  const startOfTodayWib = Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()) - WIB_OFFSET_MS;
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  return new Date(startOfTodayWib - days * 86400_000).toISOString();
}

export type CartAddStat = {
  productId: string;
  name: string;
  imageUrl: string | null;
  adds: number;
  carts: number;
  preorderAdds: number;
};

export type OpenCart = {
  id: string;
  customerEmail: string | null;
  customerName: string | null;
  customerId: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  updatedAt: string;
  reminderSentAt: string | null;
};

export async function getCartReport(range: CartRange): Promise<{ adds: CartAddStat[]; openCarts: OpenCart[] }> {
  await requireAdmin();
  const service = serviceClient();
  const since = rangeStart(range);

  const [{ data: adds, error: addsError }, { data: carts, error: cartsError }] = await Promise.all([
    service.from("cart_adds").select("cart_id, product_id, is_preorder").gte("created_at", since).limit(20000),
    service
      .from("carts")
      .select("id, customer_id, items, item_count, subtotal, updated_at, reminder_sent_at")
      .is("converted_at", null)
      .gt("item_count", 0)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (addsError) throw new Error(addsError.message);
  if (cartsError) throw new Error(cartsError.message);

  const byProduct = new Map<string, { adds: number; carts: Set<string>; preorderAdds: number }>();
  for (const a of adds ?? []) {
    const stat = byProduct.get(a.product_id) ?? { adds: 0, carts: new Set<string>(), preorderAdds: 0 };
    stat.adds++;
    stat.carts.add(a.cart_id);
    if (a.is_preorder) stat.preorderAdds++;
    byProduct.set(a.product_id, stat);
  }

  const productIds = [...byProduct.keys()];
  const customerIds = [...new Set((carts ?? []).map((c) => c.customer_id).filter(Boolean))] as string[];
  const [{ data: products }, { data: customers }] = await Promise.all([
    productIds.length
      ? service.from("products").select("id, name, image_url").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; name: string; image_url: string | null }[] }),
    customerIds.length
      ? service.from("customers").select("id, email, name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; email: string; name: string | null }[] }),
  ]);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  return {
    adds: [...byProduct.entries()]
      .map(([productId, s]) => ({
        productId,
        name: productById.get(productId)?.name ?? "Unknown product",
        imageUrl: productById.get(productId)?.image_url ?? null,
        adds: s.adds,
        carts: s.carts.size,
        preorderAdds: s.preorderAdds,
      }))
      .sort((a, b) => b.adds - a.adds),
    openCarts: (carts ?? []).map((c) => ({
      id: c.id,
      customerId: c.customer_id,
      customerEmail: c.customer_id ? (customerById.get(c.customer_id)?.email ?? null) : null,
      customerName: c.customer_id ? (customerById.get(c.customer_id)?.name ?? null) : null,
      items: (c.items ?? []) as CartItem[],
      itemCount: c.item_count,
      subtotal: Number(c.subtotal),
      updatedAt: c.updated_at,
      reminderSentAt: c.reminder_sent_at,
    })),
  };
}
