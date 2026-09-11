import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { copy } from "@/lib/copy";
import { CartProvider } from "./CartContext";
import { WishlistProvider } from "./WishlistContext";
import { WhatsAppProvider } from "./WhatsAppContext";
import StoreHeader from "./StoreHeader";
import StoreMain from "./StoreMain";
import AnnouncementBar from "./AnnouncementBar";
import StoreFooter from "./StoreFooter";
import MarketplaceLinks from "./MarketplaceLinks";
import CartDrawer from "./CartDrawer";
import WhatsAppFloatingButton from "./WhatsAppFloatingButton";

export const metadata: Metadata = {
  title: "ZLAP CARD",
  description: "Authentic Pokemon and One Piece trading cards, shipped across Indonesia.",
};

const DEFAULT_TAGLINE = copy.announcementDefaults.tagline;
const DEFAULT_ANNOUNCEMENTS = copy.announcementDefaults.messages;

// Best-effort: a missing/not-yet-migrated storefront_settings table must
// never take down the entire storefront (same lesson as recordProductView) —
// fall back to the same copy the DB defaults to.
async function getHeaderCopy(): Promise<{ tagline: string; announcements: string[] }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("storefront_settings")
      .select("header_tagline, announcement_messages")
      .eq("id", 1)
      .single();
    if (!data) return { tagline: DEFAULT_TAGLINE, announcements: DEFAULT_ANNOUNCEMENTS };
    return {
      tagline: data.header_tagline || DEFAULT_TAGLINE,
      announcements:
        data.announcement_messages?.length ? data.announcement_messages : DEFAULT_ANNOUNCEMENTS,
    };
  } catch (err) {
    console.error("Failed to load storefront_settings, using defaults:", err);
    return { tagline: DEFAULT_TAGLINE, announcements: DEFAULT_ANNOUNCEMENTS };
  }
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { tagline, announcements } = await getHeaderCopy();

  return (
    <CartProvider>
      <WishlistProvider>
        <WhatsAppProvider>
          <StoreHeader tagline={tagline} />
          <AnnouncementBar messages={announcements} />
          <StoreMain>{children}</StoreMain>
          <MarketplaceLinks />
          <StoreFooter />
          <CartDrawer />
          <WhatsAppFloatingButton />
        </WhatsAppProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
