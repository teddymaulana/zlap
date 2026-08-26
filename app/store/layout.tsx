import { cookies } from "next/headers";
import PasswordGate from "./PasswordGate";
import { CartProvider } from "./CartContext";
import { WishlistProvider } from "./WishlistContext";
import StoreHeader from "./StoreHeader";
import AnnouncementBar from "./AnnouncementBar";
import StoreFooter from "./StoreFooter";
import CartDrawer from "./CartDrawer";

const STOREFRONT_PASSWORD = process.env.STOREFRONT_PASSWORD || "zlapdev";
const ACCESS_COOKIE = "storefront_access";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(ACCESS_COOKIE)?.value === STOREFRONT_PASSWORD;

  if (!hasAccess) {
    return <PasswordGate />;
  }

  return (
    <CartProvider>
      <WishlistProvider>
        <StoreHeader />
        <AnnouncementBar />
        <main className="pb-16">{children}</main>
        <StoreFooter />
        <CartDrawer />
      </WishlistProvider>
    </CartProvider>
  );
}
