"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// Renders nothing — fires the "Product View" analytics event from the
// browser, so prefetches and bots hitting the server render don't count.
export default function ProductViewTracker({ productId, name }: { productId: string; name: string }) {
  useEffect(() => {
    trackEvent(
      "Product View",
      { productId, product: name },
      { event: "view_item", params: { items: [{ item_id: productId, item_name: name }] } }
    );
  }, [productId, name]);

  return null;
}
