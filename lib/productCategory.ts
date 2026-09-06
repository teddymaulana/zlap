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

// Tagged inconsistently across the catalog as either "booster box" or
// "booster_box" — matched here (and by the storefront's category filter) so
// either spelling counts.
export function isBoosterBoxProduct(p: { tags: string[] | null }): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  return tags.some((t) => t.includes("booster_box") || t.includes("booster box"));
}
