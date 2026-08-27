import { Resend } from "resend";

// Transactional order emails via Resend. Every send* function here is
// best-effort: failures are logged, never thrown — an email hiccup must
// never break checkout, the payment webhook, saving an AWB, or a
// cancellation decision (same lesson as recordProductView).
// Read lazily (not captured in a module-level const) so a long-running dev
// server picks up .env.local changes without a restart — Next.js reloads
// process.env on file change, but a value already captured at module-load
// time into a const won't reflect that.
function resendClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}
// Resend's own onboarding sender works without a verified domain — swap in
// a real address (e.g. "Zlap Cards <orders@zlapcards.com>") once a domain
// is verified in the Resend dashboard.
function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "Zlap Cards <onboarding@resend.dev>";
}

// Hosted in Supabase storage (not /public) so the URL is stable and publicly
// reachable regardless of which environment sends the email.
const LOGO_URL =
  "https://xjucizvelqtinmvvnyxr.supabase.co/storage/v1/object/public/site-assets/zlap-logo.png";

const SITE_URL = "https://zlapcard.com";

function wrapEmail(heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <table role="presentation" width="100%" style="padding: 20px 4px;">
        <tr>
          <td style="vertical-align: middle;">
            <h1 style="font-size: 18px; margin: 0;">${heading}</h1>
          </td>
          <td style="vertical-align: middle; text-align: right;">
            <img src="${LOGO_URL}" alt="Zlap Cards" width="80" height="80" style="width:80px; height:80px; display:inline-block;" />
          </td>
        </tr>
      </table>
      <div style="border-top: 1px solid #e5e7eb; padding: 24px 4px;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 4px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
        Zlap Collectibles
        <div style="margin-top: 8px;">
          <a href="https://instagram.com/zlapcard" style="color: #6b7280; text-decoration: underline; margin-right: 12px;">Instagram</a>
          <a href="https://tiktok.com/@zlap.collectibles" style="color: #6b7280; text-decoration: underline; margin-right: 12px;">TikTok</a>
          <a href="https://wa.me/6285121369155" style="color: #6b7280; text-decoration: underline;">WhatsApp</a>
        </div>
      </div>
    </div>
  `;
}

async function send(to: string, subject: string, html: string) {
  const resend = resendClient();
  if (!resend) {
    console.error(`Email not sent (RESEND_API_KEY not configured): "${subject}" to ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: fromAddress(), to, subject, html });
    if (error) console.error(`Email send failed: "${subject}" to ${to}:`, error.message);
  } catch (err) {
    console.error(`Email send threw: "${subject}" to ${to}:`, err);
  }
}

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function orderLookupLink(orderCode: string): string {
  const url = `${SITE_URL}/store/orders/lookup?order=${encodeURIComponent(orderCode)}`;
  return `<p style="margin-top:16px;"><a href="${url}" style="color:#111; text-decoration:underline;">Check your order status</a></p>`;
}

export type OrderConfirmationLine = { name: string; qty: number; price: number; imageUrl?: string | null };

export async function sendOrderConfirmationEmail(params: {
  to: string;
  orderCode: string;
  lines: OrderConfirmationLine[];
  total: number;
  paymentMethod: string;
  vaNumber?: string;
  bank?: string;
  paymentCode?: string;
  store?: string;
}) {
  const linesHtml = params.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 0; width:48px;">
            ${
              l.imageUrl
                ? `<img src="${l.imageUrl}" width="40" height="40" alt="" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #e5e7eb; display:block;" />`
                : `<div style="width:40px; height:40px; border-radius:4px; background:#f3f4f6;"></div>`
            }
          </td>
          <td style="padding:8px 0 8px 8px;">${l.name} × ${l.qty}</td>
          <td style="padding:8px 0; text-align:right;">${formatMoney(l.price * l.qty)}</td>
        </tr>`
    )
    .join("");

  let paymentHtml = "";
  if (params.vaNumber) {
    paymentHtml = `<p>Pay via <strong>${(params.bank ?? "").toUpperCase()} Virtual Account</strong>: <strong>${params.vaNumber}</strong></p>`;
  } else if (params.paymentCode) {
    paymentHtml = `<p>Pay in-store at <strong>${params.store}</strong> with code: <strong>${params.paymentCode}</strong></p>`;
  } else {
    paymentHtml = `<p>Complete your ${params.paymentMethod} payment to confirm this order.</p>`;
  }

  const html = wrapEmail(
    "Order confirmed",
    `
      <p>Thanks for your order <strong>${params.orderCode}</strong> — we'll process it once payment is confirmed.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">${linesHtml}
        <tr style="font-weight:700; border-top:1px solid #e5e7eb;"><td colspan="2" style="padding-top:8px;">Total</td><td style="padding-top:8px; text-align:right;">${formatMoney(params.total)}</td></tr>
      </table>
      ${paymentHtml}
      ${orderLookupLink(params.orderCode)}
    `
  );

  await send(params.to, `Order confirmed — ${params.orderCode}`, html);
}

export async function sendPaymentConfirmedEmail(params: { to: string; orderCode: string }) {
  const html = wrapEmail(
    "Payment received",
    `<p>We've received your payment for order <strong>${params.orderCode}</strong>. We'll get it packed and shipped shortly.</p>
     ${orderLookupLink(params.orderCode)}`
  );
  await send(params.to, `Payment confirmed — ${params.orderCode}`, html);
}

export async function sendShippedEmail(params: { to: string; orderCode: string; awb: string }) {
  const html = wrapEmail(
    "Your order has shipped",
    `<p>Order <strong>${params.orderCode}</strong> is on its way.</p>
     <p>Tracking (AWB): <strong>${params.awb}</strong></p>
     ${orderLookupLink(params.orderCode)}`
  );
  await send(params.to, `Your order has shipped — ${params.orderCode}`, html);
}

export async function sendCancellationApprovedEmail(params: {
  to: string;
  orderCode: string;
  refunded: boolean;
}) {
  const refundNote = params.refunded
    ? "Your payment will be refunded shortly."
    : "If this order was already paid, we'll be in touch about your refund.";
  const html = wrapEmail(
    "Order cancelled",
    `<p>Order <strong>${params.orderCode}</strong> has been cancelled as requested.</p><p>${refundNote}</p>
     ${orderLookupLink(params.orderCode)}`
  );
  await send(params.to, `Order cancelled — ${params.orderCode}`, html);
}

export async function sendCancellationRejectedEmail(params: { to: string; orderCode: string }) {
  const html = wrapEmail(
    "Cancellation request declined",
    `<p>We're unable to cancel order <strong>${params.orderCode}</strong> — it's already being processed. Reach out to us if you have questions.</p>
     ${orderLookupLink(params.orderCode)}`
  );
  await send(params.to, `About your cancellation request — ${params.orderCode}`, html);
}

export async function sendRefundCompletedEmail(params: { to: string; orderCode: string }) {
  const html = wrapEmail(
    "Refund completed",
    `<p>Your refund for order <strong>${params.orderCode}</strong> has been processed.</p>
     ${orderLookupLink(params.orderCode)}`
  );
  await send(params.to, `Refund completed — ${params.orderCode}`, html);
}

export async function sendOfferReceivedEmail(params: {
  to: string;
  productName: string;
  offeredPrice: number;
}) {
  const html = wrapEmail(
    "Offer received",
    `<p>We've received your offer of <strong>${formatMoney(params.offeredPrice)}</strong> for <strong>${params.productName}</strong>.</p>
     <p>We'll email you if it's accepted — usually within a day or two.</p>`
  );
  await send(params.to, `Offer received — ${params.productName}`, html);
}

export async function sendOfferApprovedEmail(params: {
  to: string;
  productName: string;
  productImageUrl?: string | null;
  offeredPrice: number;
  checkoutUrl: string;
  expiresAt: string;
}) {
  const expiry = new Date(params.expiresAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const imageHtml = params.productImageUrl
    ? `<img src="${params.productImageUrl}" width="72" height="72" alt="" style="width:72px; height:72px; object-fit:cover; border-radius:6px; border:1px solid #e5e7eb; display:block;" />`
    : `<div style="width:72px; height:72px; border-radius:6px; background:#f3f4f6;"></div>`;
  const html = wrapEmail(
    "Your offer was accepted!",
    `<table role="presentation" style="margin:4px 0 16px;"><tr>
       <td style="padding-right:12px;">${imageHtml}</td>
       <td style="vertical-align:middle;">
         Good news — your offer of <strong>${formatMoney(params.offeredPrice)}</strong> for <strong>${params.productName}</strong> was accepted.
       </td>
     </tr></table>
     <p style="margin-top:16px;">
       <a href="${params.checkoutUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600;">Complete your purchase</a>
     </p>
     <p style="margin-top:16px; font-size:13px; color:#6b7280;">This link expires ${expiry}.</p>`
  );
  await send(params.to, `Your offer was accepted — ${params.productName}`, html);
}

export async function sendOfferRejectedEmail(params: { to: string; productName: string }) {
  const html = wrapEmail(
    "About your offer",
    `<p>Thanks for your offer on <strong>${params.productName}</strong> — unfortunately we're not able to accept it this time.</p>
     <p>Feel free to check back or reach out if you'd like to try another price.</p>`
  );
  await send(params.to, `About your offer — ${params.productName}`, html);
}
