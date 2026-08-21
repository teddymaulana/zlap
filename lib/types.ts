export type Product = {
  id: string;
  name: string;
  sku: string | null;
  tags: string[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryBatch = {
  id: string;
  product_id: string;
  qty: number;
  cost: number;
  fee_pct: number;
  add_up_pct: number;
  acquired_date: string | null;
  locked: boolean;
  purchase_id: string | null;
  created_at: string;
};

export type InventoryBatchAvailability = InventoryBatch & { available: number };

export type Purchase = {
  id: string;
  name: string | null;
  date: string | null;
  inter_shipping: number;
  forwarding: number;
  local_cargo: number;
  payment_fee: number;
  other_expense: number;
  deduction: number;
  created_at: string;
};

export type PurchaseLine = {
  id: string;
  purchase_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  exclude_cost: boolean;
  use_custom_landed_cost: boolean;
  custom_landed_cost: number | null;
  pushed: boolean;
  inventory_batch_id: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_id: string;
  channel: "tokopedia" | "shopee" | "website" | "direct" | null;
  date: string | null;
  order_url: string | null;
  status: "pending" | "completed";
  created_at: string;
};

export type OrderLine = {
  id: string;
  order_id: string;
  product_id: string;
  inventory_batch_id: string | null;
  price: number | null;
  created_at: string;
};

export type Balance = {
  id: string;
  date: string;
  type: "in" | "out" | null;
  category:
    | "shopee_payout"
    | "tokopedia_payout"
    | "direct_payout"
    | "expenses"
    | "deposit"
    | "withdrawal"
    | "stock_purchase"
    | "shipping"
    | "ads"
    | null;
  amount: number;
  name: string | null;
  notes: string | null;
  created_at: string;
};

export type MarketplaceBalances = {
  id: string;
  shopee_to_settle: number;
  tokopedia_to_settle: number;
  updated_at: string;
};

export type Snapshot = {
  id: string;
  snapshot_date: string;
  value: number | null;
  deposit: number | null;
  tokopedia: number | null;
  shopee: number | null;
  created_at: string;
};
