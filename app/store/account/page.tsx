import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer, getCustomerOrders } from "@/app/actions/customer";
import { getWishlistProducts } from "@/app/actions/storefront";
import { formatStatus } from "@/lib/format";
import ProductCard from "../ProductCard";
import SignOutButton from "./SignOutButton";
import CancelOrderButton from "./CancelOrderButton";

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/store/account/login");

  const [orders, wishlist] = await Promise.all([getCustomerOrders(), getWishlistProducts()]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{customer.name ?? customer.email}</h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
        </div>
        <SignOutButton />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Order history</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="divide-y rounded border">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/store/account/orders/${o.id}`} className="hover:underline">
                  <div className="font-medium">{o.order_id}</div>
                  <div className="text-xs text-gray-500">{o.date}</div>
                </Link>
                <div className="flex items-center gap-3">
                  {o.status === "cancelled" ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Cancelled
                    </span>
                  ) : o.cancellation_requested_at ? (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      Cancellation requested
                    </span>
                  ) : (
                    o.status === "pending" && <CancelOrderButton orderId={o.id} />
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      o.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : o.payment_status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatStatus(o.payment_status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Wishlist</h2>
        {wishlist.length === 0 ? (
          <p className="text-sm text-gray-500">No saved products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {wishlist.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
