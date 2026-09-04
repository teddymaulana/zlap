import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function Nav() {
  return (
    <nav className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/zlap-adm/dashboard">Dashboard</Link>
        <Link href="/zlap-adm/products">Products</Link>
        <Link href="/zlap-adm/purchases">Purchases</Link>
        <Link href="/zlap-adm/orders">Orders</Link>
        <Link href="/zlap-adm/offers">Offers</Link>
        <Link href="/zlap-adm/requests">Requests</Link>
        <Link href="/zlap-adm/stock-notifications">Notifications</Link>
        <Link href="/zlap-adm/balance">Balance</Link>
        <Link href="/zlap-adm/charts">Charts</Link>
        <Link href="/zlap-adm/storefront">Storefront</Link>
        <Link href="/zlap-adm/sets">Sets</Link>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm text-gray-500 hover:underline">
          Sign out
        </button>
      </form>
    </nav>
  );
}
