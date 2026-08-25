// Midtrans Core API (https://api-docs.midtrans.com/) — server-to-server only,
// no card data ever touches our backend since none of the payment types we
// use here (VA, QRIS, GoPay, ShopeePay, Indomaret/cstore) involve a card
// tokenization flow.
const BASE_URL =
  process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";

export type MidtransChargeRequest = {
  payment_type: "bank_transfer" | "qris" | "gopay" | "shopeepay" | "cstore";
  transaction_details: { order_id: string; gross_amount: number };
  bank_transfer?: { bank: "bca" | "bni" | "bri" | "permata" };
  gopay?: { enable_callback: boolean };
  shopeepay?: { callback_url: string };
  cstore?: { store: "indomaret" | "alfamart"; message?: string };
  item_details?: { id: string; price: number; quantity: number; name: string }[];
  customer_details?: { first_name: string; phone: string };
};

export type MidtransChargeResponse = {
  status_code: string;
  status_message: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  va_numbers?: { bank: string; va_number: string }[];
  actions?: { name: string; method: string; url: string }[];
  // e.g. "2026-08-23 13:47:24" — QRIS/GoPay codes expire ~15 min after
  // creation; cstore (Indomaret/Alfamart) payment codes are valid ~24h.
  expiry_time?: string;
  // cstore (Indomaret/Alfamart) — the code the customer reads to the cashier.
  payment_code?: string;
  store?: string;
  // Permata VA doesn't come back through va_numbers like the other banks —
  // it's this separate top-level field instead.
  permata_va_number?: string;
};

export async function chargeMidtrans(
  body: MidtransChargeRequest
): Promise<MidtransChargeResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("Payment isn't configured yet — check back soon");

  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(`${BASE_URL}/v2/charge`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as MidtransChargeResponse;
  if (!res.ok) {
    throw new Error(data.status_message || "Payment could not be started");
  }
  return data;
}

export type MidtransRefundResponse = {
  status_code: string;
  status_message: string;
  refund_amount?: string;
};

// Only some payment types support refund via the API — notably bank_transfer
// (VA) does NOT, since it's a direct transfer into the merchant's VA rather
// than money Midtrans holds. Callers must catch failures here and fall back
// to a manual refund for those methods (see approveCancellation in
// app/actions/orders.ts).
export async function refundMidtrans(
  orderId: string,
  amount: number,
  reason: string
): Promise<MidtransRefundResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("Payment isn't configured yet — check back soon");

  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(`${BASE_URL}/v2/${orderId}/refund`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ amount, reason }),
  });

  const data = (await res.json()) as MidtransRefundResponse;
  if (!res.ok) {
    throw new Error(data.status_message || "Refund could not be processed");
  }
  return data;
}
