export type CardSet = {
  id: string;
  name: string;
  brand: "pokemon" | "one_piece";
  language: "en" | "jp" | "id";
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  tags: string[];
  image_url: string | null;
  brand: "pokemon" | "one_piece" | null;
  set_id: string | null;
  featured_section_1: boolean;
  featured_section_1_order: number | null;
  featured_section_2: boolean;
  featured_section_2_order: number | null;
  offers_enabled: boolean;
  offer_min_price: number | null;
  show_when_oos: boolean;
  created_at: string;
  updated_at: string;
};

export type StockNotification = {
  id: string;
  product_id: string;
  email: string | null;
  phone: string | null;
  notified: boolean;
  created_at: string;
};

export type Offer = {
  id: string;
  product_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  offered_price: number;
  qty: number;
  status: "pending" | "approved" | "rejected" | "expired" | "completed";
  checkout_token: string | null;
  token_expires_at: string | null;
  responded_at: string | null;
  order_id: string | null;
  created_at: string;
};

export type CardRequest = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  card_name: string;
  set_name: string | null;
  grade: string | null;
  reference_url: string | null;
  notes: string | null;
  qty: number;
  status: "pending" | "quoted" | "rejected" | "expired" | "completed";
  quoted_price: number | null;
  snkrdunk_url: string | null;
  product_id: string | null;
  checkout_token: string | null;
  token_expires_at: string | null;
  responded_at: string | null;
  order_id: string | null;
  created_at: string;
};

export type StorefrontSection = {
  id: "featured_section_1" | "featured_section_2";
  title: string;
};

export type StorefrontSettings = {
  id: number;
  header_tagline: string;
  announcement_messages: string[];
  updated_at: string;
};

export type PopularKeyword = {
  id: string;
  keyword: string;
};

export type StorefrontShortcutBadge = "fire" | "new" | "sale";

export type StorefrontShortcut = {
  id: string;
  label: string;
  href: string;
  image_url: string | null;
  badge: StorefrontShortcutBadge | null;
  // Null only for rows inserted before display ordering existed — treat as
  // sorting last, same convention as the featured-section order columns.
  position: number | null;
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
  direct_price: number | null;
  is_storefront_price: boolean;
  is_preorder: boolean;
  preorder_duration_days: number | null;
  preorder_arrival_date: string | null;
  storefront_qty_limit: number | null;
};

export type InventoryBatchAvailability = InventoryBatch & {
  available: number;
  storefront_available: number;
};

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
  status: "pending" | "completed" | "cancelled";
  awb: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_email: string | null;
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refund_pending" | "refunded";
  payment_method: string | null;
  payment_details: {
    transaction_id?: string;
    va_number?: string;
    bank?: string;
    qr_url?: string;
    qr_expiry?: string;
    deeplink_url?: string;
    payment_code?: string;
    store?: string;
  } | null;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  checkout_token: string | null;
  token_expires_at: string | null;
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
