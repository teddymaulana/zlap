"use server";

export type ShippingArea = {
  id: string;
  name: string;
};

type BiteshipAreaResponse = {
  success: boolean;
  areas?: { id: string; name: string }[];
};

// Biteship's area search — city/district/postal-code level only, not full
// street addresses. Used to reduce shipping-address entry errors at
// checkout; unlike trackShipment (app/actions/tracking.ts) this isn't tied
// to a specific courier.
export async function searchShippingArea(query: string): Promise<ShippingArea[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3 || !process.env.BITESHIP_API_KEY) return [];

  try {
    const res = await fetch(
      `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(trimmed)}&type=single`,
      { headers: { Authorization: process.env.BITESHIP_API_KEY }, cache: "no-store" }
    );
    const data = (await res.json()) as BiteshipAreaResponse;
    if (!data.success) return [];
    return (data.areas ?? []).slice(0, 8).map((a) => ({ id: a.id, name: a.name }));
  } catch (err) {
    console.error("Biteship area search failed:", err);
    return [];
  }
}
