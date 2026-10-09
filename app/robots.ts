import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin, API, and per-customer pages (carts, checkout, accounts,
      // orders, tokenized pay/offer/request links) have nothing to index.
      disallow: [
        "/zlap-adm",
        "/api/",
        "/cart",
        "/checkout",
        "/account",
        "/orders",
        "/track",
        "/pay/",
        "/offers/",
        "/requests/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
