import { createProduct } from "@/app/actions/products";
import TagPicker from "@/app/products/TagPicker";

export default function NewProductPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">New product</h1>
      <form action={createProduct} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" required className="rounded border px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sku" className="text-sm font-medium">
            SKU
          </label>
          <input id="sku" name="sku" className="rounded border px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tags</span>
          <TagPicker />
        </div>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Create
        </button>
      </form>
    </div>
  );
}
