// DOKU Checkout (https://developers.doku.com/accept-payments/doku-checkout) —
// a hosted payment page, unlike Midtrans's Core API: this returns a redirect
// URL rather than an inline VA number/QR code, and the customer picks their
// payment channel (VA/QRIS/e-wallet/retail) on DOKU's own page.
//
// Request/response and notification shapes follow DOKU's published docs
// and samples; still run one sandbox payment end to end (DOKU's "Simulate
// payment and Notification" tool) before switching production over.
import { createHash, createHmac, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPaymentConfirmedEmail } from "@/lib/email";

const BASE_URL =
  process.env.DOKU_IS_PRODUCTION === "true" ? "https://api.doku.com" : "https://api-sandbox.doku.com";

const PAYMENT_PATH = "/checkout/v1/payment";

export type DokuChargeRequest = {
  order: {
    amount: number;
    invoice_number: string;
    currency: "IDR";
    // Where DOKU sends the customer back regardless of outcome (paid,
    // pending, or they abandoned it) — see checkout.ts's use of this.
    callback_url: string;
    callback_url_result?: string;
    line_items?: { name: string; price: number; quantity: number }[];
  };
  payment: { payment_due_date: number };
  customer?: { name: string; email: string; phone: string; address: string; country: "ID" };
};

export type DokuChargeResponse = {
  message: string[];
  response: {
    order: { invoice_number: string; amount: string };
    payment: { url: string; token_id: string; expired_date: string };
  };
};

// DOKU signs every non-SNAP request (and every notification it sends back to
// us) the same way: HMAC-SHA256 over a fixed multi-line string, keyed by the
// merchant's Secret Key. See
// https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap
function computeSignature(params: {
  clientId: string;
  requestId: string;
  timestamp: string;
  target: string;
  // Omitted for GET requests (e.g. Check Status), which have no body — see
  // https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap/signature-from-api-get-method
  digest?: string;
  secretKey: string;
}) {
  const raw = [
    `Client-Id:${params.clientId}`,
    `Request-Id:${params.requestId}`,
    `Request-Timestamp:${params.timestamp}`,
    `Request-Target:${params.target}`,
    ...(params.digest !== undefined ? [`Digest:${params.digest}`] : []),
  ].join("\n");
  return `HMACSHA256=${createHmac("sha256", params.secretKey).update(raw).digest("base64")}`;
}

// RFC 3339 with no fractional seconds, e.g. "2026-08-23T13:47:24Z" — the
// format DOKU's docs show for Request-Timestamp.
function requestTimestamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

// DOKU rejects free-text fields (line item names, customer name/address)
// containing anything outside a-z A-Z 0-9 space . - / + , = _ : ' @ % ( )
// with a 400 "Invalid character" — card names routinely break that
// ("Pokémon", "&", "#", "–", "!"). Accents are folded to plain letters and
// anything else still disallowed becomes a space.
export function dokuSafeText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^a-zA-Z0-9 .\-/+,=_:'@%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function chargeDoku(body: DokuChargeRequest): Promise<DokuChargeResponse> {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!clientId || !secretKey) throw new Error("Payment isn't configured yet — check back soon");

  const requestId = randomUUID();
  const timestamp = requestTimestamp();
  const json = JSON.stringify(body);
  const digest = createHash("sha256").update(json).digest("base64");
  const signature = computeSignature({
    clientId,
    requestId,
    timestamp,
    target: PAYMENT_PATH,
    digest,
    secretKey,
  });

  const res = await fetch(`${BASE_URL}${PAYMENT_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: signature,
    },
    body: json,
  });

  // Errors come back as { message: ["INVOICE ALREADY USED"] } — the same
  // `message` array a success uses for ["SUCCESS"].
  const data = (await res.json().catch(() => ({}))) as Partial<DokuChargeResponse> & {
    error?: { message?: string };
  };
  if (!res.ok || !data.response?.payment?.url) {
    const reason = data.message?.[0] || data.error?.message;
    console.error("[doku] charge rejected", { status: res.status, reason, invoice: body.order.invoice_number });
    throw new Error(reason ? `Payment could not be started: ${reason}` : "Payment could not be started");
  }
  return data as DokuChargeResponse;
}

// Verifies the Signature header on DOKU's HTTP notification (webhook) —
// same HMAC-SHA256 scheme as outgoing requests, except Client-Id/Request-Id/
// Request-Timestamp come from DOKU's own request headers (not ones we
// generate), and Request-Target is the path DOKU POSTed to (our own
// notification route).
export function verifyDokuNotification(params: {
  clientId: string;
  requestId: string;
  timestamp: string;
  target: string;
  rawBody: string;
  signatureHeader: string;
}) {
  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!secretKey) return false;
  const digest = createHash("sha256").update(params.rawBody).digest("base64");
  const expected = computeSignature({
    clientId: params.clientId,
    requestId: params.requestId,
    timestamp: params.timestamp,
    target: params.target,
    digest,
    secretKey,
  });
  return expected === params.signatureHeader;
}

// DOKU's own transaction statuses (shared by the HTTP notification and the
// Check Status API) — see
// https://developers.doku.com/get-started-with-doku-api/check-status-api/non-snap
export type DokuTransactionStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "TIMEOUT"
  | "REDIRECT"
  | (string & {});

// Asks DOKU directly for an order's current status — the fallback for when
// the HTTP notification is delayed, dropped, or never configured. Returns
// null when DOKU has no transaction for it yet (e.g. the customer hasn't
// picked a channel on the hosted page) or the lookup fails.
export async function getDokuTransactionStatus(invoiceNumber: string): Promise<DokuTransactionStatus | null> {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!clientId || !secretKey) return null;

  const target = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const requestId = randomUUID();
  const timestamp = requestTimestamp();
  const signature = computeSignature({ clientId, requestId, timestamp, target, secretKey });

  try {
    const res = await fetch(`${BASE_URL}${target}`, {
      headers: {
        "Client-Id": clientId,
        "Request-Id": requestId,
        "Request-Timestamp": timestamp,
        Signature: signature,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { transaction?: { status?: string } };
    return data.transaction?.status ?? null;
  } catch {
    return null;
  }
}

// Maps a DOKU status onto our payment_status and applies it — shared by the
// notification webhook and the Check Status fallback so both behave the
// same. FAILED/TIMEOUT/REDIRECT are ignored: per DOKU's Checkout guidance a
// failed attempt just means the customer can retry another channel on the
// same hosted page. Never moves an order backwards out of "paid" (e.g. a
// late PENDING redelivery) except to "refunded", and only emails on the
// actual transition into "paid".
export async function applyDokuStatus(
  service: SupabaseClient,
  invoiceNumber: string,
  dokuStatus: DokuTransactionStatus
): Promise<{ error?: string }> {
  const newStatus =
    dokuStatus === "SUCCESS"
      ? "paid"
      : dokuStatus === "PENDING"
        ? "pending"
        : dokuStatus === "EXPIRED"
          ? "expired"
          : dokuStatus === "REFUNDED"
            ? "refunded"
            : null;
  if (!newStatus) return {};

  const { data: existing } = await service
    .from("orders")
    .select("id, customer_email, payment_status")
    .eq("order_id", invoiceNumber)
    .maybeSingle();
  if (!existing) return { error: "Order not found" };
  if (existing.payment_status === newStatus) return {};
  if (
    ["paid", "refund_pending", "refunded"].includes(existing.payment_status) &&
    newStatus !== "refunded"
  ) {
    return {};
  }

  const { error } = await service.from("orders").update({ payment_status: newStatus }).eq("id", existing.id);
  if (error) return { error: error.message };

  if (newStatus === "paid" && existing.customer_email) {
    await sendPaymentConfirmedEmail({ to: existing.customer_email, orderCode: invoiceNumber });
  }
  return {};
}
