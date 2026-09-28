// Shared rules for Japan-sourced pre-orders (products.po_*, see the
// "Pre-orders sourced from Japan" block in supabase/schema.sql). Pure and
// client-safe: the storefront, checkout, admin, and customer order pages
// all use these so they agree on prices, estimates, and progress.

export type PoMarkupType = "percent" | "fixed";

// Shown to customers before the purchase ships from Japan.
export const PO_ESTIMATE_WEEKS = { min: 2, max: 5 } as const;
export const PO_DEFAULT_MARKUP_PERCENT = 25;
// Default Japan -> Indonesia transit estimate staff start from when marking
// a purchase shipped.
export const PO_DEFAULT_TRANSIT_DAYS = 10;
// Per product, per order — keeps one checkout from committing us to buy an
// open-ended number of copies at a price that may move.
export const PO_MAX_QTY_PER_ORDER = 5;
// Default products.po_open_limit — most open (not yet received) pre-order
// units per product at once.
export const PO_DEFAULT_OPEN_LIMIT = 5;
// A saved price older than this is treated as unavailable rather than sold
// on — the refresh runs every 3 days (vercel.json), so this leaves a day of
// slack for a late run before prices are hidden.
export const PO_PRICE_MAX_AGE_DAYS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

// A percentage markup can go negative (below market — used to make a cheap
// test payment) but not past this, and no price goes below the floor.
export const PO_MIN_MARKUP_PERCENT = -99;
export const PO_MIN_PRICE = 1000;

// Market base (JPY) -> IDR, plus markup, rounded up to the next IDR 1,000.
export function computePoPrice(
  baseJpy: number,
  fxRate: number,
  markupType: PoMarkupType,
  markupValue: number
): number {
  const baseIdr = baseJpy * fxRate;
  const marked = markupType === "fixed" ? baseIdr + markupValue : baseIdr * (1 + markupValue / 100);
  return Math.max(PO_MIN_PRICE, Math.ceil(marked / 1000) * 1000);
}

export function isPoPriceFresh(updatedAt: string | null | undefined, now = Date.now()): boolean {
  if (!updatedAt) return false;
  return now - new Date(updatedAt).getTime() <= PO_PRICE_MAX_AGE_DAYS * DAY_MS;
}

// The price a customer can actually buy at right now, or null when the
// product isn't open for pre-order (disabled, never priced, or stale).
export function activePoPrice(p: {
  po_enabled: boolean | null;
  po_price: number | null;
  po_price_updated_at: string | null;
}): number | null {
  if (!p.po_enabled || !p.po_price || !isPoPriceFresh(p.po_price_updated_at)) return null;
  return Number(p.po_price);
}

// Pre-order units still available under the product's open limit.
export function poSlotsLeft(openLimit: number | null | undefined, openCount: number): number {
  return Math.max(0, (openLimit ?? PO_DEFAULT_OPEN_LIMIT) - openCount);
}

// The staff "price went up" alert: the last refresh raised the price and
// nobody has dismissed it since.
export function hasPoPriceIncrease(p: {
  po_price: number | null;
  po_price_previous: number | null;
  po_price_changed_at: string | null;
  po_price_alert_dismissed_at: string | null;
}): boolean {
  if (p.po_price === null || p.po_price_previous === null || !p.po_price_changed_at) return false;
  if (Number(p.po_price) <= Number(p.po_price_previous)) return false;
  if (!p.po_price_alert_dismissed_at) return true;
  return new Date(p.po_price_alert_dismissed_at).getTime() < new Date(p.po_price_changed_at).getTime();
}

export function addDays(iso: string, days: number): Date {
  return new Date(new Date(iso).getTime() + days * DAY_MS);
}

// Where a customer's pre-order stands. Stages only ever move forward; an
// order line not yet placed in a purchase is still "ordered".
export type PoStage = "ordered" | "buying" | "bought" | "shipping" | "arrived" | "shipped_to_customer";

export type PoDelay = { days: number; reason: string; createdAt: string };

export type PoProgress = {
  stage: PoStage;
  orderedAt: string | null;
  boughtAt: string | null;
  shippedAt: string | null;
  arrivedAt: string | null;
  transitDays: number | null;
  delays: PoDelay[];
  awb: string | null;
  courier: string;
};

// Estimated arrival in Indonesia once shipped from Japan — transit days plus
// every delay staff have added since.
export function poEta(progress: Pick<PoProgress, "shippedAt" | "transitDays" | "delays">): Date | null {
  if (!progress.shippedAt) return null;
  const delayDays = progress.delays.reduce((sum, d) => sum + d.days, 0);
  return addDays(progress.shippedAt, (progress.transitDays ?? PO_DEFAULT_TRANSIT_DAYS) + delayDays);
}

// Whole days until `date` (0 once it's today or past).
export function daysUntil(date: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((date.getTime() - now) / DAY_MS));
}
