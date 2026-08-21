import { createPurchase } from "@/app/actions/purchases";

export default function NewPurchasePage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">New purchase</h1>
      <form action={createPurchase} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" className="rounded border px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <input id="date" name="date" type="date" className="rounded border px-3 py-2" />
        </div>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Create
        </button>
      </form>
    </div>
  );
}
