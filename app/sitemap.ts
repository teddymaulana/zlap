import type { MetadataRoute } from "next";
import { getSitemapProducts } from "@/app/actions/storefront";
import { SITE_URL } from "@/lib/constants";

// Regenerated at most hourly so new products get picked up without querying
// Supabase on every crawler hit.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getSitemapProducts().catch((err) => {
    console.error("Failed to load sitemap products:", err);
    return [];
  });

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...products.map((p) => ({
      url: `${SITE_URL}/products/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
