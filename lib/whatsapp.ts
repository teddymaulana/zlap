import type { SupabaseClient } from "@supabase/supabase-js";

// Staff WhatsApp alerts via Meta's WhatsApp Cloud API. Same contract as
// lib/email.ts: best-effort, failures are logged and never thrown — a
// WhatsApp hiccup must never break checkout or a payment webhook.
//
// Business-initiated messages must use a Meta-approved template. The one
// used here (WHATSAPP_ORDER_TEMPLATE, "Utility" category) has 4 body
// variables, in this order:
//   Order update: {{1}}
//   Order: {{2}}
//   Customer: {{3}}
//   Total: {{4}}
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

async function sendTemplate(params: string[]) {
  const cfg = config();
  if (!cfg) {
    console.error("WhatsApp alert not sent (WHATSAPP_* env not configured):", params.join(" | "));
    return;
  }
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

// Sent from chargeExistingOrder once the payment has been started — the order
// exists and is waiting on the customer to pay.
export async function sendNewOrderAdminAlert(params: { orderCode: string; customerName: string; total: number }) {
  await sendTemplate(["New order, awaiting payment", params.orderCode, params.customerName, formatMoney(params.total)]);
}

// Sent from the Midtrans/DOKU webhooks on the actual transition into "paid".
// Looks the order up itself since the webhooks only carry the order code.
// Total = sum of order_lines.price, the same way orderCheckout.ts derives it.
export async function sendOrderPaidAdminAlert(service: SupabaseClient, orderCode: string) {
  try {
    const { data: order } = await service
      .from("orders")
      .select("id, customer_name")
      .eq("order_id", orderCode)
      .maybeSingle();
    if (!order) return;
    const { data: lines } = await service.from("order_lines").select("price").eq("order_id", order.id);
    const total = (lines ?? []).reduce((sum, l) => sum + (Number(l.price) || 0), 0);
    await sendTemplate(["Paid", orderCode, order.customer_name ?? "-", formatMoney(total)]);
  } catch (err) {
    console.error(`WhatsApp paid alert for ${orderCode} threw:`, err);
  }
}
