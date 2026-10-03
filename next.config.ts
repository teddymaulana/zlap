import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos live in the Supabase "product-images" bucket.
    remotePatterns: [new URL("https://xjucizvelqtinmvvnyxr.supabase.co/storage/v1/object/public/**")],
    formats: ["image/avif", "image/webp"],
    // Uploads get a fresh timestamped path (app/actions/products.ts), so a
    // given URL never changes content — safe to keep optimized copies a month.
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
