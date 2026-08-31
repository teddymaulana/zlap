import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import PasswordGate from "./PasswordGate";
import { CartProvider } from "./CartContext";
import { WishlistProvider } from "./WishlistContext";
import { WhatsAppProvider } from "./WhatsAppContext";
import StoreHeader from "./StoreHeader";
import AnnouncementBar from "./AnnouncementBar";
import StoreFooter from "./StoreFooter";
import CartDrawer from "./CartDrawer";
import WhatsAppFloatingButton from "./WhatsAppFloatingButton";

const STOREFRONT_PASSWORD = process.env.STOREFRONT_PASSWORD || "zlapdev";
const ACCESS_COOKIE = "storefront_access";

export const metadata: Metadata = {
  title: "ZLAP CARD",
  description: "Authentic Pokemon and One Piece trading cards, shipped across Indonesia.",
};

const DEFAULT_TAGLINE = "Free shipping across Indonesia on every order";
const DEFAULT_ANNOUNCEMENTS = [
  "We currently ship within Indonesia only",
  "100% authentic cards, checked before shipping",
];

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
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(ACCESS_COOKIE)?.value === STOREFRONT_PASSWORD;

  if (!hasAccess) {
    return <PasswordGate />;
  }

  const { tagline, announcements } = await getHeaderCopy();

  return (
    <CartProvider>
      <WishlistProvider>
        <WhatsAppProvider>
          <StoreHeader tagline={tagline} />
          <AnnouncementBar messages={announcements} />
          <main className="min-h-screen bg-gray-50 pb-16">{children}</main>
          <StoreFooter />
          <CartDrawer />
          <WhatsAppFloatingButton />
        </WhatsAppProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
