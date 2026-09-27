// Couriers an order can ship with. Keys are Biteship's courier_code (used
// as-is in its tracking API — see app/actions/tracking.ts) and are what
// orders.courier stores; supabase/schema.sql's check constraint must list
// the same keys.
export const COURIERS = {
  jnt: "J&T Express",
  jne: "JNE",
} as const;

export type Courier = keyof typeof COURIERS;

export const DEFAULT_COURIER: Courier = "jnt";

export function courierName(courier: string | null | undefined): string {
  return COURIERS[(courier ?? DEFAULT_COURIER) as Courier] ?? courier ?? COURIERS[DEFAULT_COURIER];
}

export function isCourier(value: string): value is Courier {
  return value in COURIERS;
}
