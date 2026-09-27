"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getGiftCatalog, type GiftCatalogItem } from "@/app/actions/gwp";
import { getStorefrontAvailability } from "@/app/actions/storefront";
import { computeEarnedGifts, giftRoleForTags, type GiftRole } from "@/lib/gwp";
import {
  getBogoFreeProductCatalog,
  getStorefrontDiscounts,
  redeemDiscountCode,
  type BogoFreeProduct,
} from "@/app/actions/discounts";
import { computeEarnedBogoFreebies, applyCodeToCart, type CartCodeLine, type Discount } from "@/lib/discounts";
import { PO_MAX_QTY_PER_ORDER } from "@/lib/preorder";

export type CartItem = {
  // Unique per cart line: the product id for an in-stock line, and
  // `${productId}:po` for a pre-order line (see preorderCartId), so the same
  // product can sit in the cart both ways at once.
  id: string;
  // Set on pre-order lines only — the real product id behind `id`. Use
  // cartProductId() rather than reading either field directly.
  productId?: string;
  isPreorder?: boolean;
  // Pre-order lines only: the most this line can hold — the per-order cap
  // or the product's remaining open slots, whichever is lower (see
  // preorderMaxQty). Checkout re-checks both server-side.
  poMaxQty?: number;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  qty: number;
  tags: string[];
  // The card set's language (EN/JP/ID) — carried through to checkout/order/
  // email display for graded and single items, where it materially affects
  // the item. Optional since not every addItem caller (e.g. gift lines
  // below) has a set to resolve it from.
  setLanguage?: "en" | "jp" | "id" | null;
  // Auto-added gift-with-purchase line — see CartProvider's sync effect
  // below. Never set by addItem; the UI should hide qty/remove controls for
  // these since they're recomputed (and re-added) on every render anyway.
  isGift: boolean;
  // What the gift item would normally sell for, so the cart can show it
  // crossed out next to "Free". Null/unset for ordinary (non-gift) items.
  originalPrice?: number | null;
};

type NewCartItem = Omit<CartItem, "qty" | "isGift" | "tags"> & { tags?: string[] };

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: NewCartItem) => Promise<void>;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalPrice: number;
  // Discount code redeemed in the cart (see applyCodeToCart in lib/discounts.ts).
  appliedCode: string | null;
  appliedDiscount: Discount | null;
  // Per-product effective unit price after the code (falls back to the
  // item's own price for anything the code doesn't target) — what
  // CartDrawer should actually display/charge per line.
  codePriceByProduct: Map<string, number>;
  // Lump sum knocked off the total for a whole-cart code — 0 for a
  // product-scoped code, since that's already reflected per line above.
  cartDiscountAmount: number;
  applyDiscountCode: (code: string) => Promise<{ error?: string }>;
  removeDiscountCode: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function preorderCartId(productId: string) {
  return `${productId}:po`;
}

export function cartProductId(item: Pick<CartItem, "id" | "productId">) {
  return item.productId ?? item.id;
}

export function preorderMaxQty(slotsLeft: number | null | undefined) {
  return Math.min(PO_MAX_QTY_PER_ORDER, slotsLeft ?? PO_MAX_QTY_PER_ORDER);
}

const STORAGE_KEY = "zlap_cart";
const CODE_STORAGE_KEY = "zlap_cart_code";

// Order-independent — so the gift-sync effect below can tell "nothing
// actually changed" apart from "the array was rebuilt with the same
// contents" without caring what order gift lines happen to be appended in.
function cartSignature(items: CartItem[]) {
  return items
    .map((i) => `${i.id}:${i.qty}`)
    .sort()
    .join(",");
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState<GiftCatalogItem[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [bogoFreeProducts, setBogoFreeProducts] = useState<BogoFreeProduct[]>([]);
  const [giftDataLoaded, setGiftDataLoaded] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  // The discount behind appliedCode, as returned by redeemDiscountCode — the
  // cart never holds the full list of code-gated discounts (see
  // getStorefrontDiscounts), so it can't look a code up locally.
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    // localStorage doesn't exist during SSR, so this has to run post-mount —
    // a lazy useState initializer would just reproduce the SSR-empty value.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
      const code = localStorage.getItem(CODE_STORAGE_KEY);
      if (code) {
        setAppliedCode(code);
        // Re-validate a code remembered from an earlier visit — it may have
        // been deactivated (or used up) since; drop it silently if so.
        redeemDiscountCode(code)
          .then((result) => {
            if ("discount" in result) setAppliedDiscount(result.discount);
            else setAppliedCode(null);
          })
          .catch(() => setAppliedCode(null));
      }
    } catch {
      // ignore malformed/inaccessible storage — cart just starts empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore — e.g. private browsing with storage disabled
    }
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (appliedCode) localStorage.setItem(CODE_STORAGE_KEY, appliedCode);
      else localStorage.removeItem(CODE_STORAGE_KEY);
    } catch {
      // ignore — e.g. private browsing with storage disabled
    }
  }, [appliedCode, hydrated]);

  useEffect(() => {
    Promise.allSettled([getGiftCatalog(), getStorefrontDiscounts(), getBogoFreeProductCatalog()]).then(
      ([gift, discountsResult, bogoProducts]) => {
        // Gift/BOGO preview just won't show up client-side on failure;
        // checkout still recomputes both authoritatively server-side.
        if (gift.status === "fulfilled") setGiftCatalog(gift.value);
        if (discountsResult.status === "fulfilled") setDiscounts(discountsResult.value);
        if (bogoProducts.status === "fulfilled") setBogoFreeProducts(bogoProducts.value);
        setGiftDataLoaded(true);
      }
    );
  }, []);

  // Auto GWP + BOGO: whenever the cart's real (non-gift) items change,
  // recompute which free items they've earned from either system and
  // reconcile the gift lines to match — adding, resizing, or dropping them
  // as needed. This is only a preview; createOrderAndCharge recomputes the
  // same thing server-side from scratch at checkout, so a customer can't
  // tamper with these via localStorage.
  useEffect(() => {
    if (!hydrated || !giftDataLoaded) return;

    // Pre-order lines don't earn gifts or BOGO freebies — only in-stock ones.
    const qualifying = items.filter((i) => !i.isGift && !i.isPreorder);
    const earnedGwp = computeEarnedGifts(qualifying.map((i) => ({ tags: i.tags, qty: i.qty })));
    const earnedBogo = computeEarnedBogoFreebies(
      qualifying.map((i) => ({ productId: i.id, qty: i.qty })),
      discounts
    );

    // Merged by product id so a product earned by both systems at once (an
    // unlikely but possible admin setup) gets one combined line, not two
    // entries sharing the same id.
    const freeQtyById = new Map<string, number>();
    for (const role of Object.keys(earnedGwp) as GiftRole[]) {
      const qty = earnedGwp[role];
      if (qty <= 0) continue;
      const product = giftCatalog.find((p) => giftRoleForTags(p.tags) === role);
      if (!product) continue;
      freeQtyById.set(product.id, (freeQtyById.get(product.id) ?? 0) + qty);
    }
    for (const [productId, qty] of earnedBogo) {
      if (qty <= 0) continue;
      freeQtyById.set(productId, (freeQtyById.get(productId) ?? 0) + qty);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- same pattern as the hydration effect above: syncing derived state (earned gifts) from other state, not responding to an external event.
    setItems((prev) => {
      const nonGift = prev.filter((i) => !i.isGift);
      const giftLines: CartItem[] = [];
      for (const [productId, qty] of freeQtyById) {
        const fromGwp = giftCatalog.find((p) => p.id === productId);
        const fromBogo = bogoFreeProducts.find((p) => p.id === productId);
        const source = fromGwp ?? fromBogo;
        if (!source) continue;
        giftLines.push({
          id: productId,
          name: source.name,
          sku: null,
          image_url: source.image_url,
          price: 0,
          qty,
          tags: fromGwp?.tags ?? [],
          isGift: true,
          originalPrice: source.originalPrice,
        });
      }

      const next = [...nonGift, ...giftLines];
      return cartSignature(prev) === cartSignature(next) ? prev : next;
    });
  }, [items, giftCatalog, discounts, bogoFreeProducts, giftDataLoaded, hydrated]);

  const addItem = async (product: NewCartItem) => {
    if (product.isPreorder) {
      // No stock to check — capped per order instead (the server enforces
      // the same cap at checkout).
      setItems((prev) => {
        const existing = prev.find((i) => i.id === product.id);
        const max = product.poMaxQty ?? PO_MAX_QTY_PER_ORDER;
        if (existing) {
          if (existing.qty >= max) return prev;
          return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1, poMaxQty: max } : i));
        }
        return [...prev, { ...product, tags: product.tags ?? [], isGift: false, qty: 1 }];
      });
      setIsOpen(true);
      return;
    }
    // Re-fetch live stock right before adding — the same numeric count the
    // cart drawer's "+" stepper caps against — so a product card or PDP
    // can't push a line past what's actually available (the drawer button
    // only clamps its own increment; it never protected these entry points).
    const [row] = await getStorefrontAvailability([product.id]);
    const available = row?.available;
    // A product that's not in the cart yet and has just sold out (stock hit
    // 0 between page load and this click) has nothing to show for itself —
    // don't pop the drawer open with no explanation. An item already in the
    // cart at its cap still opens the drawer, where the "Only N in stock"
    // label under it explains why the qty didn't move.
    let addedOrAlreadyPresent = true;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (typeof available === "number" && existing.qty >= available) return prev;
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (typeof available === "number" && available <= 0) {
        addedOrAlreadyPresent = false;
        return prev;
      }
      return [...prev, { ...product, tags: product.tags ?? [], isGift: false, qty: 1 }];
    });
    if (addedOrAlreadyPresent) setIsOpen(true);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => {
    setItems([]);
    setAppliedCode(null);
    setAppliedDiscount(null);
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, qty: i.isPreorder ? Math.min(qty, i.poMaxQty ?? PO_MAX_QTY_PER_ORDER) : qty } : i
      )
    );
  };

  // Discount codes apply to in-stock lines only; pre-order lines keep their
  // own price (their ids never appear in codePriceByProduct).
  const codeLines: CartCodeLine[] = items
    .filter((i) => !i.isGift && !i.isPreorder)
    .map((i) => ({
      productId: i.id,
      qty: i.qty,
      basePrice: i.originalPrice ?? i.price ?? 0,
      autoPrice: i.price ?? 0,
    }));
  const { priceByProduct: codePriceByProduct, cartDiscountAmount } = applyCodeToCart(
    codeLines,
    appliedDiscount
  );

  const applyDiscountCode = async (rawCode: string): Promise<{ error?: string }> => {
    const result = await redeemDiscountCode(rawCode);
    if ("error" in result) return { error: result.error };
    setAppliedCode(rawCode.trim());
    setAppliedDiscount(result.discount);
    return {};
  };

  const removeDiscountCode = () => {
    setAppliedCode(null);
    setAppliedDiscount(null);
  };

  const totalCount = items.reduce((sum, i) => sum + i.qty, 0);
  const totalPrice =
    items.reduce((sum, i) => sum + (codePriceByProduct.get(i.id) ?? i.price ?? 0) * i.qty, 0) -
    cartDiscountAmount;

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalCount,
        totalPrice,
        appliedCode,
        appliedDiscount,
        codePriceByProduct,
        cartDiscountAmount,
        applyDiscountCode,
        removeDiscountCode,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
