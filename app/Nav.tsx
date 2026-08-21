import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function Nav() {
  return (
    <nav className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/products">Products</Link>
        <Link href="/purchases">Purchases</Link>
        <Link href="/orders">Orders</Link>
        <Link href="/balance">Balance</Link>
        <Link href="/charts">Charts</Link>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm text-gray-500 hover:underline">
          Sign out
        </button>
      </form>
    </nav>
  );
}
