"use client";

import { track } from "@vercel/analytics";
import { sendGAEvent } from "@next/third-parties/google";

type Props = Record<string, string | number | boolean | null>;

// Sends one storefront event to both Vercel Analytics and GA4. Vercel gets a
// readable name with at most 2 properties; GA4 gets its recommended
// ecommerce event name/params where one exists, so its built-in reports
// (purchases, searches, item views) pick it up.
export function trackEvent(name: string, props: Props, ga: { event: string; params: Record<string, unknown> }) {
  try {
    track(name, props);
    sendGAEvent("event", ga.event, ga.params);
  } catch {
    // Analytics must never break the storefront.
  }
}
