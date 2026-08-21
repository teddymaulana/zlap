export const PAGE_SIZE = 25;

export const BALANCE_CATEGORIES = [
  { value: "shopee_payout", label: "Shopee Payout" },
  { value: "tokopedia_payout", label: "Tokopedia Payout" },
  { value: "direct_payout", label: "Direct Payout" },
  { value: "expenses", label: "Expenses" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "stock_purchase", label: "Stock Purchase" },
  { value: "shipping", label: "Shipping" },
  { value: "ads", label: "Ads" },
] as const;

export const PRODUCT_TAGS = [
  "booster_box",
  "booster_pack",
  "graded",
  "etb",
  "upc",
  "set_kolektor",
  "single",
  "psa",
  "psa10",
  "japanese",
  "english",
  "indonesia",
  "blokees",
  "special_box",
] as const;
