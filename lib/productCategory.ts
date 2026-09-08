// Shared with app/actions/storefront.ts's category filter (server-only) and
// ProductCard (client) — kept in a plain module so both sides can call it
// directly instead of round-tripping through a server action.
export function isSlabProduct(p: { tags: string[] | null; name: string }): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  const nameLower = p.name.toLowerCase();
  return tags.some((t) => t.includes("graded")) || nameLower.includes("psa");
}

export function isEtbProduct(p: { tags: string[] | null }): boolean {
  return (p.tags ?? []).some((t) => t.toLowerCase() === "etb");
}

// Graded slabs and loose singles are the two categories where the card's
// set language (EN/JP/ID) materially affects the item (a JP single reads
// differently than an EN one) — shown on the cart line item, order, and
// confirmation email for exactly these two categories.
export function isGradedOrSingleProduct(p: { tags: string[] | null; name: string }): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  return isSlabProduct(p) || tags.includes("single");
}

// Tagged inconsistently across the catalog as either "booster box" or
// "booster_box" — matched here (and by the storefront's category filter) so
// either spelling counts.
export function isBoosterBoxProduct(p: { tags: string[] | null }): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  return tags.some((t) => t.includes("booster_box") || t.includes("booster box"));
}
