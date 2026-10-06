import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/app/actions/adminCustomers";
import { formatStatus } from "@/lib/format";
import CustomerForm from "./CustomerForm";
import CustomerActions from "./CustomerActions";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCustomer(id);
  if (!result) notFound();
  const { customer, orders, activeSessionCount, wishlistCount } = result;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/zlap-adm/customers" className="text-sm text-gray-500 hover:underline">
        ← Customers
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold">{customer.name || customer.email}</h1>
      <div className="mb-6 text-sm text-gray-500">
        Joined {formatDateTime(customer.created_at)} · {customer.hasPassword ? "Password" : "Google-only"} sign-in ·{" "}
        {customer.email_verified_at
          ? `Email verified ${formatDateTime(customer.email_verified_at)}`
          : "Email not verified"}{" "}
        · {wishlistCount} wishlist {wishlistCount === 1 ? "item" : "items"}
      </div>

      <section className="mb-8 rounded border p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Details</h2>
        <CustomerForm customer={customer} />
      </section>

      <section className="mb-8 rounded border p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Account</h2>
        <CustomerActions
          customerId={customer.id}
          customerLabel={customer.name || customer.email}
          emailVerified={!!customer.email_verified_at}
          activeSessionCount={activeSessionCount}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Orders ({orders.length})</h2>
        <div className="divide-y rounded border">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/zlap-adm/orders/${o.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{o.order_id}</div>
                <div className="text-sm text-gray-500">{o.date ?? formatDateTime(o.created_at)}</div>
              </div>
              <div className="text-sm text-gray-600">
                {formatStatus(o.payment_status)} · {o.status === "completed" ? "Fulfilled" : formatStatus(o.status)}
              </div>
            </Link>
          ))}
          {orders.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No orders placed while signed in.</div>}
        </div>
      </section>
    </div>
  );
}
