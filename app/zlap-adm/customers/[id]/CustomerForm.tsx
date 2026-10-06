"use client";

import { useState, useTransition } from "react";
import { updateCustomer, type AdminCustomer } from "@/app/actions/adminCustomers";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function CustomerForm({ customer }: { customer: AdminCustomer }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  return (
    <form
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const { error } = await updateCustomer(customer.id, formData);
          setMessage(error ? { error: true, text: error } : { error: false, text: "Saved" });
        });
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Name</span>
        <input name="name" defaultValue={customer.name ?? ""} required className="w-full rounded border px-3 py-2" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={customer.email}
          required
          className="w-full rounded border px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Phone</span>
        <input name="phone" defaultValue={customer.phone ?? ""} className="w-full rounded border px-3 py-2" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="relative rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Save</span>
          {isPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
        {message && (
          <span className={`text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</span>
        )}
        <span className="text-xs text-gray-400">Changing the email clears its verification.</span>
      </div>
    </form>
  );
}
