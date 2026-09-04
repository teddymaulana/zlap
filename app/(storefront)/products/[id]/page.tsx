import { notFound } from "next/navigation";
import {
  getStorefrontProductDetail,
  getStorefrontProductRecentSales,
  getRelatedProducts,
  recordProductView,
} from "@/app/actions/storefront";
import { PRODUCT_BRANDS } from "@/lib/constants";
import ProductDetailActions from "./ProductDetailActions";
import OfferButton from "./OfferButton";
import SalesChart from "./SalesChart";
import ProductCard from "../../ProductCard";
import WhatsAppProductAnnouncer from "../../WhatsAppProductAnnouncer";
import { copy, fillCopy } from "@/lib/copy";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function preorderText(preorder: { days?: number; date?: string } | null) {
  if (!preorder) return null;
  if (preorder.date) {
    const date = new Date(preorder.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return fillCopy(copy.product.arrivesOn, { date });
  }
  return fillCopy(copy.product.shipsInDays, { days: preorder.days ?? 30 });
}

export default async function StorefrontProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getStorefrontProductDetail(id);
  if (!product) notFound();
  await recordProductView(id);
  const recentSales = await getStorefrontProductRecentSales(id);
  const relatedProducts = await getRelatedProducts(id);

  const brandLabel = PRODUCT_BRANDS.find((b) => b.value === product.brand)?.label ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <WhatsAppProductAnnouncer name={product.name} path={`/products/${product.id}`} />
      <div className="grid gap-8 sm:grid-cols-2">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="aspect-square w-full rounded border object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded border bg-gray-50 text-sm text-gray-400">
            {copy.common.noImage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold">{product.name}</h1>

          {(brandLabel || product.setName) && (
            <div className="flex flex-col gap-0.5 text-sm text-gray-600">
              {brandLabel && <div>{brandLabel}</div>}
              {product.setName && <div>{product.setName}</div>}
            </div>
          )}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {product.preorder && (
            <div className="text-sm text-blue-700">{preorderText(product.preorder)}</div>
          )}

          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {product.price !== null ? formatMoney(product.price) : copy.common.priceUnavailable}
          </div>

          <div className="mt-2">
            <ProductDetailActions product={product} />
          </div>

          {product.offersEnabled && product.price !== null && (
            <div className="mt-2">
              <OfferButton productId={product.id} productName={product.name} currentPrice={product.price} />
            </div>
          )}

          <div className="mt-4">
            <SalesChart data={recentSales} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-3 rounded bg-orange-50 px-4 py-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0 text-orange-700"
        >
          <rect x="1" y="6" width="15" height="12" rx="1" />
          <path d="M16 10h3.5a1 1 0 0 1 .9.55L22 14v4a1 1 0 0 1-1 1h-2" />
          <circle cx="6.5" cy="18.5" r="1.5" />
          <circle cx="16.5" cy="18.5" r="1.5" />
        </svg>
        <span className="text-sm font-semibold text-orange-800">{copy.product.freeShipping}</span>
      </div>

      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{copy.product.relatedItems}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
