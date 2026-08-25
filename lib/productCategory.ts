// Shared with app/actions/storefront.ts's category filter (server-only) and
// ProductCard (client) — kept in a plain module so both sides can call it
// directly instead of round-tripping through a server action.
export function isSlabProduct(p: { tags: string[] | null; name: string }): boolean {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  const nameLower = p.name.toLowerCase();
  return tags.some((t) => t.includes("graded")) || nameLower.includes("psa");
}
