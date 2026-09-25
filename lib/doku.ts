// DOKU Checkout (https://developers.doku.com/accept-payments/doku-checkout) —
// a hosted payment page, unlike Midtrans's Core API: this returns a redirect
// URL rather than an inline VA number/QR code, and the customer picks their
// payment channel (VA/QRIS/e-wallet/retail) on DOKU's own page.
//
// Request/response and notification shapes follow DOKU's published docs
// and samples; still run one sandbox payment end to end (DOKU's "Simulate
// payment and Notification" tool) before switching production over.
import { createHash, createHmac, randomUUID } from "crypto";

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
  digest: string;
  secretKey: string;
}) {
  const raw = [
    `Client-Id:${params.clientId}`,
    `Request-Id:${params.requestId}`,
    `Request-Timestamp:${params.timestamp}`,
    `Request-Target:${params.target}`,
    `Digest:${params.digest}`,
  ].join("\n");
  return `HMACSHA256=${createHmac("sha256", params.secretKey).update(raw).digest("base64")}`;
}

// RFC 3339 with no fractional seconds, e.g. "2026-08-23T13:47:24Z" — the
// format DOKU's docs show for Request-Timestamp.
function requestTimestamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
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

  const data = (await res.json()) as DokuChargeResponse & { error_messages?: string[] };
  if (!res.ok) {
    throw new Error(data.error_messages?.[0] || "Payment could not be started");
  }
  return data;
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
