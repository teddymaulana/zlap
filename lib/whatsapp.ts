import type { SupabaseClient } from "@supabase/supabase-js";

// Staff WhatsApp alerts via Meta's WhatsApp Cloud API. Same contract as
// lib/email.ts: best-effort, failures are logged and never thrown — a
// WhatsApp hiccup must never break checkout or a payment webhook.
//
// Business-initiated messages must use a Meta-approved template. The one
// used here (WHATSAPP_ORDER_TEMPLATE, "Utility" category) is one of:
//   admin_order_alert (default)    admin_order_items
//     Order update: {{1}}            Order update: {{1}}
//     Order: {{2}}                   Order: {{2}}
//     Customer: {{3}}                Customer: {{3}}
//     Total: {{4}}                   Items: {{4}}
//                                    Total: {{5}}
//
// Env (read lazily, like lib/email.ts, so .env.local edits apply without a
// dev server restart):
//   WHATSAPP_TOKEN            system-user access token
//   WHATSAPP_PHONE_NUMBER_ID  sender's Phone Number ID (not the phone number)
//   WHATSAPP_ADMIN_NUMBERS    comma-separated recipients, e.g. 62812...,62813...
//   WHATSAPP_ORDER_TEMPLATE   template name (default admin_order_alert)
//   WHATSAPP_TEMPLATE_LANG    template language code (default en)

const GRAPH_API_VERSION = "v23.0";
const SEND_TIMEOUT_MS = 5000;
// Meta caps a body parameter well above this; kept short so a big order
// still reads as one message.
const MAX_ITEMS_LENGTH = 700;

function config() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipients = (process.env.WHATSAPP_ADMIN_NUMBERS ?? "")
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter(Boolean);
  if (!token || !phoneNumberId || recipients.length === 0) return null;
  return {
    token,
    phoneNumberId,
    recipients,
    template: process.env.WHATSAPP_ORDER_TEMPLATE || "admin_order_alert",
    lang: process.env.WHATSAPP_TEMPLATE_LANG || "en",
  };
}

// Template parameters can't contain newlines/tabs or runs of 4+ spaces.
function cleanParam(value: string): string {
  return value.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-";
}

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

type OrderAlertFields = { update: string; orderCode: string; customer: string; items: string; total: string };

// Body variables in the order each template expects them.
function templateParams(template: string, f: OrderAlertFields): string[] {
  if (template === "admin_order_items") return [f.update, f.orderCode, f.customer, f.items, f.total];
  return [f.update, f.orderCode, f.customer, f.total];
}

async function sendTemplate(fields: OrderAlertFields) {
  const cfg = config();
  if (!cfg) {
    console.error("WhatsApp alert not sent (WHATSAPP_* env not configured):", Object.values(fields).join(" | "));
    return;
  }
  const params = templateParams(cfg.template, fields);
  const body = (to: string) =>
    JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cfg.template,
        language: { code: cfg.lang },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: cleanParam(text) })) }],
      },
    });

  await Promise.all(
    cfg.recipients.map(async (to) => {
      try {
        const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${cfg.phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
          body: body(to),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (!res.ok) console.error(`WhatsApp alert to ${to} failed (${res.status}):`, await res.text());
      } catch (err) {
        console.error(`WhatsApp alert to ${to} threw:`, err);
      }
    })
  );
}

// Order lines are one row per unit — grouped here into "2x Name" per product,
// with pre-order units listed separately and marked (PO).
function formatItems(lines: { product_id: string; is_po: boolean | null }[], nameById: Map<string, string>) {
  const qtyByKey = new Map<string, { name: string; qty: number }>();
  for (const l of lines) {
    const key = `${l.product_id}:${l.is_po ? "po" : ""}`;
    const entry = qtyByKey.get(key);
    if (entry) entry.qty += 1;
    else qtyByKey.set(key, { name: `${nameById.get(l.product_id) ?? "Item"}${l.is_po ? " (PO)" : ""}`, qty: 1 });
  }
  const parts = [...qtyByKey.values()].map((e) => `${e.qty}x ${e.name}`);
  let text = "";
  for (let i = 0; i < parts.length; i++) {
    const next = text ? `${text}, ${parts[i]}` : parts[i];
    if (next.length > MAX_ITEMS_LENGTH) return `${text}, +${parts.length - i} more`;
    text = next;
  }
  return text;
}

// Looks the order up itself (both callers only need to pass the order code).
// Total = sum of order_lines.price, the same way orderCheckout.ts derives it.
async function sendOrderAlert(service: SupabaseClient, orderCode: string, update: string) {
  try {
    const { data: order } = await service
      .from("orders")
      .select("id, customer_name")
      .eq("order_id", orderCode)
      .maybeSingle();
    if (!order) return;
    const { data: lines } = await service
      .from("order_lines")
      .select("product_id, price, is_po")
      .eq("order_id", order.id);
    const orderLines = lines ?? [];
    const { data: products } = await service
      .from("products")
      .select("id, name")
      .in("id", [...new Set(orderLines.map((l) => l.product_id))]);
    const nameById = new Map((products ?? []).map((p) => [p.id, p.name as string]));
    const total = orderLines.reduce((sum, l) => sum + (Number(l.price) || 0), 0);
    await sendTemplate({
      update,
      orderCode,
      customer: order.customer_name ?? "-",
      items: formatItems(orderLines, nameById),
      total: formatMoney(total),
    });
  } catch (err) {
    console.error(`WhatsApp "${update}" alert for ${orderCode} threw:`, err);
  }
}

// Sent from chargeExistingOrder once the payment has been started — the order
// exists and is waiting on the customer to pay.
export async function sendNewOrderAdminAlert(service: SupabaseClient, orderCode: string) {
  await sendOrderAlert(service, orderCode, "New order, awaiting payment");
}

// Sent from the Midtrans/DOKU webhooks on the actual transition into "paid".
export async function sendOrderPaidAdminAlert(service: SupabaseClient, orderCode: string) {
  await sendOrderAlert(service, orderCode, "Paid");
}

// ---------------------------------------------------------------------------
// Free-form replies for the staff bot (app/api/whatsapp/webhook). Unlike the
// alerts above these need no template: they only ever answer a message the
// staff member just sent, which opens Meta's 24-hour customer-service window.

// WhatsApp's text body limit is 4096 characters.
const MAX_TEXT_LENGTH = 4000;

async function graphPost(payload: object): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error("WhatsApp message not sent (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured)");
    return false;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) console.error(`WhatsApp send failed (${res.status}):`, await res.text());
    return res.ok;
  } catch (err) {
    console.error("WhatsApp send threw:", err);
    return false;
  }
}

// Blue ticks plus the "typing…" bubble while the bot works on an answer
// (Meta clears it on the next message, or after ~25 seconds).
export async function markReadWithTyping(messageId: string) {
  await graphPost({ status: "read", message_id: messageId, typing_indicator: { type: "text" } });
}

// Long answers are split on paragraph (then line) breaks so each part stays
// under the limit.
function splitText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > MAX_TEXT_LENGTH) {
    const window = rest.slice(0, MAX_TEXT_LENGTH);
    let cut = window.lastIndexOf("\n\n");
    if (cut < MAX_TEXT_LENGTH / 2) cut = window.lastIndexOf("\n");
    if (cut < MAX_TEXT_LENGTH / 2) cut = MAX_TEXT_LENGTH;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function sendWhatsAppText(to: string, text: string) {
  for (const body of splitText(text)) {
    await graphPost({ to, type: "text", text: { body, preview_url: false } });
  }
}
