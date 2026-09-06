import { createDiscount } from "@/app/actions/discounts";
import { createClient } from "@/lib/supabase/server";
import DiscountForm from "../DiscountForm";

export default async function NewDiscountPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">New discount</h1>
      <DiscountForm action={createDiscount} products={products ?? []} />
    </div>
  );
}
