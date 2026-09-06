// Plain module (no server/client-only APIs) so both the cart's client-side
// preview (CartContext) and the authoritative server-side recompute at
// checkout (app/actions/checkout.ts) share one definition of discount math —
// same reasoning as lib/gwp.ts for the auto gift-with-purchase system.

export type DiscountType = "percentage" | "fixed" | "bogo";

export type Discount = {
  id: string;
  name: string;
  type: DiscountType;
  // percentage: 0-100, e.g. 20 means 20% off. Only used when type is "percentage".
  percentage: number | null;
  // IDR knocked off the price. Only used when type is "fixed".
  fixedAmount: number | null;
  // The product given away free per unit bought. Only used when type is "bogo".
  freeProductId: string | null;
  isActive: boolean;
  // Products this discount applies to (percentage/fixed) or triggers on (bogo).
  // For a code-triggered discount, empty means "the whole cart" instead.
  productIds: string[];
  // Set only for percentage/fixed discounts a customer must type into the
  // cart to redeem (see findDiscountByCode) — null means it applies
  // automatically instead, same as before codes existed.
  code: string | null;
  // Only meaningful for a code: true applies it on top of any automatic
  // discount already active on the same product(s)/cart; false ("exclusive")
  // overrides that automatic discount, computing off the pre-discount price
  // instead. See applyCodeToCart.
  stackable: boolean;
  // Only meaningful for a code: true rejects it for a guest (no signed-in
  // customer) at checkout.
  requiresLogin: boolean;
  // Only meaningful for a code: true caps it at one redemption per
  // signed-in customer (see discount_redemptions in supabase/schema.sql) —
  // implicitly requires login too, regardless of requiresLogin.
  oncePerCustomer: boolean;
};

// Automatic discounts apply on their own everywhere a product is priced;
// a discount with a code only takes effect once a customer redeems that
// code (see findDiscountByCode/applyCodeToCart) — never automatically.
function isAutomatic(d: Discount): boolean {
  return d.isActive && d.code === null;
}

// The price a product with this discount applied would sell for. Only
// percentage/fixed discounts change price — bogo doesn't touch the trigger
// product's own price (see computeEarnedBogoFreebies for its effect).
export function applyDiscount(basePrice: number, discount: Discount): number {
  if (discount.type === "percentage" && discount.percentage) {
    return Math.max(0, basePrice * (1 - discount.percentage / 100));
  }
  if (discount.type === "fixed" && discount.fixedAmount) {
    return Math.max(0, basePrice - discount.fixedAmount);
  }
  return basePrice;
}

// Picks the discount that saves the most for a given product, among active
// percentage/fixed discounts assigned to it. Only one discount is ever
// applied per product — no stacking.
export function bestPriceDiscountForProduct(
  productId: string,
  discounts: Discount[]
): Discount | null {
  const candidates = discounts.filter(
    (d) => isAutomatic(d) && d.type !== "bogo" && d.productIds.includes(productId)
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, d) =>
    applyDiscount(0, d) < applyDiscount(0, best) ? d : best
  , candidates[0]);
}

function bestPriceDiscountByProduct(discounts: Discount[]): Map<string, Discount> {
  const byProduct = new Map<string, Discount>();
  for (const d of discounts) {
    if (!isAutomatic(d) || d.type === "bogo") continue;
    for (const productId of d.productIds) {
      const current = byProduct.get(productId);
      // Lower resulting fraction-of-original wins — compare on a fixed base
      // so percentage and fixed discounts compare fairly regardless of the
      // product's actual price.
      if (!current || applyDiscount(100000, d) < applyDiscount(100000, current)) {
        byProduct.set(productId, d);
      }
    }
  }
  return byProduct;
}

// Applies the best active percentage/fixed discount (if any) to each
// product's base price. Returns the discounted price and, only when a
// discount actually reduced it, the original price to show crossed out.
export function priceWithDiscounts(
  basePricesByProduct: Map<string, number>,
  discounts: Discount[]
): Map<string, { price: number; originalPrice: number | null }> {
  const bestByProduct = bestPriceDiscountByProduct(discounts);
  const result = new Map<string, { price: number; originalPrice: number | null }>();
  for (const [productId, basePrice] of basePricesByProduct) {
    const discount = bestByProduct.get(productId);
    if (!discount) {
      result.set(productId, { price: basePrice, originalPrice: null });
      continue;
    }
    const discounted = applyDiscount(basePrice, discount);
    result.set(productId, {
      price: discounted,
      originalPrice: discounted < basePrice ? basePrice : null,
    });
  }
  return result;
}

// Given the *real* (non-gift, non-BOGO-reward) items in a cart, computes how
// many free units of each product an active BOGO discount has earned — one
// free unit of free_product_id per unit bought of any of its assigned
// (trigger) products. Multiple BOGO discounts can independently earn their
// own free products from the same cart.
export function computeEarnedBogoFreebies(
  items: { productId: string; qty: number }[],
  discounts: Discount[]
): Map<string, number> {
  const earned = new Map<string, number>();
  for (const discount of discounts) {
    if (!isAutomatic(discount) || discount.type !== "bogo" || !discount.freeProductId) continue;
    const triggerQty = items
      .filter((i) => discount.productIds.includes(i.productId))
      .reduce((sum, i) => sum + i.qty, 0);
    if (triggerQty <= 0) continue;
    earned.set(discount.freeProductId, (earned.get(discount.freeProductId) ?? 0) + triggerQty);
  }
  return earned;
}

// Looks up a customer-entered code among the given (already active)
// discounts. Case/whitespace-insensitive, matching the unique index on
// lower(code) in supabase/schema.sql. Bogo discounts are never code-gated
// (see app/actions/discounts.ts's parseDiscountForm), so this only ever
// resolves to a percentage/fixed discount.
export function findDiscountByCode(code: string, discounts: Discount[]): Discount | null {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return discounts.find((d) => d.isActive && d.code?.toLowerCase() === normalized) ?? null;
}

export type CartCodeLine = {
  productId: string;
  qty: number;
  // Price before any automatic discount.
  basePrice: number;
  // Price after automatic discounts (== basePrice if none applied) — what
  // the line would sell for without the code.
  autoPrice: number;
};

// Applies a redeemed discount code on top of the cart's already-computed
// automatic pricing:
//  - A product-scoped code (productIds non-empty) discounts just those
//    lines' unit price directly, like an automatic discount would.
//  - A whole-cart code (productIds empty) instead knocks a lump sum off the
//    cart subtotal — returned separately as cartDiscountAmount, since
//    dividing it back across lines would just be re-deriving this same
//    number per unit.
// `stackable` decides each targeted line's starting price: the already
// automatic-discounted `autoPrice` (stacks with it) or the original
// `basePrice` (the code overrides/replaces the automatic discount).
export function applyCodeToCart(
  lines: CartCodeLine[],
  code: Discount | null
): { priceByProduct: Map<string, number>; cartDiscountAmount: number } {
  const priceByProduct = new Map<string, number>();
  if (!code) {
    for (const line of lines) priceByProduct.set(line.productId, line.autoPrice);
    return { priceByProduct, cartDiscountAmount: 0 };
  }

  const wholeCart = code.productIds.length === 0;
  for (const line of lines) {
    if (!wholeCart && !code.productIds.includes(line.productId)) {
      priceByProduct.set(line.productId, line.autoPrice);
      continue;
    }
    const start = code.stackable ? line.autoPrice : line.basePrice;
    // A whole-cart code's own cut is applied once to the subtotal below, not
    // per line — each line just reflects whether it keeps its automatic
    // discount (stackable) or has it overridden (not stackable).
    priceByProduct.set(line.productId, wholeCart ? start : applyDiscount(start, code));
  }

  let cartDiscountAmount = 0;
  if (wholeCart) {
    const subtotal = lines.reduce((sum, l) => sum + (priceByProduct.get(l.productId) ?? l.autoPrice) * l.qty, 0);
    cartDiscountAmount = Math.max(0, subtotal - applyDiscount(subtotal, code));
  }

  return { priceByProduct, cartDiscountAmount };
}
