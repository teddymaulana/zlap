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
      <div style="padding: 24px 4px 4px; text-align: center;">
        <p style="margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #111;">Authentic, Every Card Checked</p>
        <p style="margin: 0 0 16px; font-size: 12px; line-height: 1.6; color: #6b7280;">
          <strong style="color:#374151;">Account safety:</strong> watch out for suspicious activity on your account,
          keep your password up to date, and always double-check the personal details saved to it. Zlap Card
          will never ask you for your password or OTP.
        </p>
        <p style="margin: 0 0 16px; font-size: 12px; color: #6b7280;">
          Need help? Reach us on
          <a href="https://wa.me/6285121369155" style="color: #6b7280; text-decoration: underline;">WhatsApp</a>
          or <a href="mailto:info@zlapcard.com" style="color: #6b7280; text-decoration: underline;">info@zlapcard.com</a>
        </p>
      </div>
      <div style="padding: 16px 4px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0 0 12px;">— This is an automated email, please don't reply directly —</p>
        <div>
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
  const itemRowsHtml = params.lines
    .map(
      (l, i) => `
        <tr>
          <td style="padding:14px 16px; width:48px; ${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">
            ${
              l.imageUrl
                ? `<img src="${l.imageUrl}" width="40" height="40" alt="" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #e5e7eb; display:block;" />`
                : `<div style="width:40px; height:40px; border-radius:4px; background:#f3f4f6;"></div>`
            }
          </td>
          <td style="padding:14px 8px; ${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">
            <div style="font-weight:600;">${l.name}</div>
            <div style="color:#6b7280; font-size:12px; margin-top:2px;">Qty: ${l.qty}</div>
          </td>
          <td style="padding:14px 16px; text-align:right; font-weight:700; white-space:nowrap; ${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${formatMoney(l.price * l.qty)}</td>
        </tr>`
    )
    .join("");

  // Mirrors the checkout page's own Payment Method labelling so the email
  // reads the same way the customer saw it at checkout.
  const paymentMethodLabel = params.vaNumber
    ? `${(params.bank ?? "").toUpperCase()} Virtual Account`
    : params.paymentCode
      ? `${params.store ?? ""} — pay in store`
      : params.paymentMethod === "gopay"
        ? "GoPay"
        : params.paymentMethod === "shopeepay"
          ? "ShopeePay"
          : params.paymentMethod === "qris"
            ? "QRIS"
            : params.paymentMethod;

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

      <h2 style="font-size:15px; font-weight:700; margin:20px 0 8px;">Order Summary</h2>
      <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <table role="presentation" width="100%" style="border-collapse:collapse; font-size:14px;">${itemRowsHtml}</table>
      </div>

      <h2 style="font-size:15px; font-weight:700; margin:20px 0 8px;">Payment Summary</h2>
      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:14px 16px; margin-bottom:12px;">
        <table role="presentation" width="100%" style="font-size:14px;">
          <tr><td style="font-weight:700;">Payment Method</td><td style="text-align:right;">${paymentMethodLabel}</td></tr>
        </table>
      </div>
      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:14px 16px;">
        <table role="presentation" width="100%" style="font-size:14px;">
          <tr><td style="padding:4px 0; color:#374151;">Subtotal</td><td style="padding:4px 0; text-align:right;">${formatMoney(params.total)}</td></tr>
          <tr><td style="padding:4px 0; color:#374151;">Processing Fee</td><td style="padding:4px 0; text-align:right; color:#16a34a; font-weight:600;">FREE</td></tr>
          <tr><td style="padding:4px 0; color:#374151;">Shipping Fee</td><td style="padding:4px 0; text-align:right; color:#16a34a; font-weight:600;">FREE</td></tr>
          <tr><td style="padding:8px 0 0; border-top:1px solid #e5e7eb; font-weight:700;">Total</td><td style="padding:8px 0 0; border-top:1px solid #e5e7eb; text-align:right; font-weight:700;">${formatMoney(params.total)}</td></tr>
        </table>
      </div>

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

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresAt: string }) {
  const expiry = new Date(params.expiresAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const html = wrapEmail(
    "Reset your password",
    `<p>We received a request to reset your Zlap Card account password. Click below to choose a new one.</p>
     <p style="margin-top:16px;">
       <a href="${params.resetUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600;">Reset password</a>
     </p>
     <p style="margin-top:16px; font-size:13px; color:#6b7280;">This link expires ${expiry}. If you didn't request this, you can ignore this email — your password won't change.</p>`
  );
  await send(params.to, "Reset your Zlap Card password", html);
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
  originalPrice?: number | null;
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
  const priceHtml =
    params.originalPrice && params.originalPrice > params.offeredPrice
      ? `<span style="text-decoration:line-through; color:#9ca3af; margin-right:6px;">${formatMoney(params.originalPrice)}</span><strong>${formatMoney(params.offeredPrice)}</strong>`
      : `<strong>${formatMoney(params.offeredPrice)}</strong>`;
  const html = wrapEmail(
    "Your offer was accepted!",
    `<table role="presentation" style="margin:4px 0 16px;"><tr>
       <td style="padding-right:12px;">${imageHtml}</td>
       <td style="vertical-align:middle;">
         Good news — your offer for <strong>${params.productName}</strong> was accepted at ${priceHtml}.
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

export async function sendCardRequestReceivedEmail(params: { to: string; cardName: string }) {
  const html = wrapEmail(
    "Request received",
    `<p>We've received your request for <strong>${params.cardName}</strong>.</p>
     <p>We'll email you a price quote once we've sourced it — usually within a day or two.</p>`
  );
  await send(params.to, `Request received — ${params.cardName}`, html);
}

export async function sendCardRequestQuotedEmail(params: {
  to: string;
  cardName: string;
  quotedPrice: number;
  checkoutUrl: string;
  expiresAt: string;
}) {
  const expiry = new Date(params.expiresAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const html = wrapEmail(
    "Your card request has a quote!",
    `<p>Good news — we found <strong>${params.cardName}</strong> and can offer it at <strong>${formatMoney(params.quotedPrice)}</strong>.</p>
     <p style="margin-top:16px;">
       <a href="${params.checkoutUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:600;">Complete your purchase</a>
     </p>
     <p style="margin-top:16px; font-size:13px; color:#6b7280;">This link expires ${expiry}.</p>`
  );
  await send(params.to, `Your quote is ready — ${params.cardName}`, html);
}

export async function sendCardRequestRejectedEmail(params: { to: string; cardName: string }) {
  const html = wrapEmail(
    "About your card request",
    `<p>Thanks for your request for <strong>${params.cardName}</strong> — unfortunately we weren't able to source it this time.</p>
     <p>Feel free to check back or reach out if you'd like to try another card.</p>`
  );
  await send(params.to, `About your request — ${params.cardName}`, html);
}
