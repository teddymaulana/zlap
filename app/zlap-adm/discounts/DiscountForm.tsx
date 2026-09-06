"use client";

import { useState } from "react";
import ProductPicker from "./ProductPicker";
import type { Discount, DiscountType } from "@/lib/discounts";

type PickableProduct = { id: string; name: string; sku: string | null; image_url: string | null };

export default function DiscountForm({
  action,
  discount,
  products,
}: {
  action: (formData: FormData) => void | Promise<void>;
  discount?: Discount;
  products: PickableProduct[];
}) {
  const [type, setType] = useState<DiscountType>(discount?.type ?? "percentage");
  const [code, setCode] = useState(discount?.code ?? "");
  const hasCode = code.trim().length > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={discount?.name}
          placeholder="e.g. 10% off booster boxes"
          className="rounded border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Type</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="type"
              value="percentage"
              checked={type === "percentage"}
              onChange={() => setType("percentage")}
            />
            Percentage off
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="type"
              value="fixed"
              checked={type === "fixed"}
              onChange={() => setType("fixed")}
            />
            Fixed amount off
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="type"
              value="bogo"
              checked={type === "bogo"}
              onChange={() => setType("bogo")}
            />
            Buy one, get free item
          </label>
        </div>
      </div>

      {type === "percentage" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="percentage" className="text-sm font-medium">
            Percentage off
          </label>
          <div className="flex items-center gap-2">
            <input
              id="percentage"
              name="percentage"
              type="number"
              min={1}
              max={100}
              step="0.1"
              required
              defaultValue={discount?.percentage ?? undefined}
              className="w-32 rounded border px-3 py-2"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
      )}

      {type === "fixed" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="fixed_amount" className="text-sm font-medium">
            Amount off
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">IDR</span>
            <input
              id="fixed_amount"
              name="fixed_amount"
              type="number"
              min={1}
              step="1"
              required
              defaultValue={discount?.fixedAmount ?? undefined}
              className="w-40 rounded border px-3 py-2"
            />
          </div>
        </div>
      )}

      {type === "bogo" && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Free product</span>
          <p className="text-xs text-gray-500">
            One unit given free per unit bought of any trigger product below.
          </p>
          <ProductPicker
            name="free_product_id"
            products={products}
            initialIds={discount?.freeProductId ? [discount.freeProductId] : []}
            multiple={false}
          />
        </div>
      )}

      {type !== "bogo" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium">
            Discount code (optional)
          </label>
          <p className="text-xs text-gray-500">
            Leave blank to apply automatically. Set a code and customers must enter it in the
            cart to redeem it — assigned products then become optional (empty applies to the
            whole cart).
          </p>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. WELCOME10"
            className="w-48 rounded border px-3 py-2 uppercase"
          />
        </div>
      )}

      {type !== "bogo" && hasCode && (
        <div className="flex flex-col gap-2 rounded border bg-gray-50 p-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="stackable" defaultChecked={discount?.stackable ?? false} />
            Stackable — applies on top of any automatic discount already active, instead of
            overriding it
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="requires_login" defaultChecked={discount?.requiresLogin ?? false} />
            Requires a signed-in customer (rejected for guest checkout)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              name="once_per_customer"
              defaultChecked={discount?.oncePerCustomer ?? false}
            />
            Once per customer — each signed-in customer can redeem it only once (implies
            requiring sign-in)
          </label>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {type === "bogo" ? "Trigger products" : hasCode ? "Assigned products (optional)" : "Assigned products"}
        </span>
        <p className="text-xs text-gray-500">
          {type === "bogo"
            ? "Buying any of these earns the free product above."
            : hasCode
              ? "Leave empty to discount the whole cart subtotal instead of specific products."
              : "This discount applies to these products' storefront price."}
        </p>
        <ProductPicker name="product_ids" products={products} initialIds={discount?.productIds} />
      </div>

      <label className="flex items-center gap-1.5 text-sm font-medium">
        <input type="checkbox" name="is_active" defaultChecked={discount?.isActive ?? true} />
        Active
      </label>

      <button type="submit" className="rounded bg-black px-3 py-2 text-white">
        {discount ? "Save" : "Create"}
      </button>
    </form>
  );
}
