import { isEtbProduct, isBoosterBoxProduct } from "./productCategory";

// Auto "gift with purchase" — plain module (no server/client-only APIs) so
// both the cart's client-side preview (CartContext) and the authoritative
// server-side recompute at checkout (app/actions/checkout.ts) share one
// definition of what's earned and how gift products are identified.

export type GiftRole = "etb_protector" | "toploader" | "sleeve";

// These 3 products are ordinary rows in `products` (with real inventory
// batches, so stock can be tracked), but are never given an
// is_storefront_price batch — that's what keeps them out of search, featured
// sections, and direct product pages (see priceByProductId in
// app/actions/storefront.ts). This tag is the only thing that marks a
// product as one of them, so admin can retag a replacement product if one is
// ever discontinued/recreated.
export const GIFT_ROLE_TAGS: Record<GiftRole, string> = {
  etb_protector: "gift_etb_protector",
  toploader: "gift_toploader",
  sleeve: "gift_sleeve",
};

export const ALL_GIFT_TAGS = Object.values(GIFT_ROLE_TAGS);

export function giftRoleForTags(tags: string[] | null | undefined): GiftRole | null {
  const lower = new Set((tags ?? []).map((t) => t.toLowerCase()));
  for (const role of Object.keys(GIFT_ROLE_TAGS) as GiftRole[]) {
    if (lower.has(GIFT_ROLE_TAGS[role])) return role;
  }
  return null;
}

export function isGiftProduct(tags: string[] | null | undefined): boolean {
  return giftRoleForTags(tags) !== null;
}

// Given the *real* (non-gift) items in a cart, computes how many of each
// free gift role they've earned:
//  - 1 ETB Plastic Case Protector per ETB unit (tag "etb")
//  - 1 Toploader per 2 Booster Box units and every multiple of 2 (tag
//    "booster box"/"booster_box")
//  - 1 Sleeve per 3 Booster Box units and every multiple of 3
//  These two are independent tiers on the same booster box count, not a
//  split of it (so 4 boxes -> 2 toploaders + 1 sleeve, 6 boxes -> 3
//  toploaders + 2 sleeves).
export function computeEarnedGifts(
  items: { tags: string[] | null | undefined; qty: number }[]
): Record<GiftRole, number> {
  let etbQty = 0;
  let boosterBoxQty = 0;
  for (const item of items) {
    if (isEtbProduct({ tags: item.tags ?? null })) etbQty += item.qty;
    if (isBoosterBoxProduct({ tags: item.tags ?? null })) boosterBoxQty += item.qty;
  }
  return {
    etb_protector: etbQty,
    toploader: Math.floor(boosterBoxQty / 2),
    sleeve: Math.floor(boosterBoxQty / 3),
  };
}
