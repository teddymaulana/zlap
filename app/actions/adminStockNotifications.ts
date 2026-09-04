"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StockNotification } from "@/lib/types";

export type AdminStockNotificationRow = StockNotification & {
  productName: string;
  productImageUrl: string | null;
};

export async function getStockNotifications(): Promise<AdminStockNotificationRow[]> {
  const supabase = await createClient();

  const { data: notifications, error } = await supabase
    .from("stock_notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!notifications || notifications.length === 0) return [];

  const productIds = [...new Set(notifications.map((n) => n.product_id))];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_url")
    .in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return notifications.map((n) => ({
    ...n,
    productName: productById.get(n.product_id)?.name ?? "Unknown product",
    productImageUrl: productById.get(n.product_id)?.image_url ?? null,
  }));
}

export async function markStockNotificationNotified(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stock_notifications").update({ notified: true }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/stock-notifications");
}

export async function deleteStockNotification(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stock_notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/stock-notifications");
}
