import Image from "next/image";
import Link from "next/link";
import type { JpSet, JpSetStatus } from "@/app/actions/storefront";

const ZLAP_MARK = "/zlap-logo.png";

const STATUS_LABEL: Record<JpSetStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "sold-out": "Sold out",
};

// All ≥4.5:1 against #fff and #fbfbf9.
const STATUS_COLOR: Record<JpSetStatus, string> = {
  "in-stock": "#1f7a3d",
  "low-stock": "#96590a",
  "sold-out": "#5e5c54",
};

const idr = (n: number) => `IDR ${Math.round(n).toLocaleString("id-ID")}`;

const releaseDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function SpecRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${last ? "" : "border-b border-[#eceae4] pb-[9px]"}`}>
      <dt className="text-[11px] font-bold tracking-[0.08em] text-[#6b6960] uppercase">{label}</dt>
      <dd className="text-right text-xs font-bold text-[#14100a]">{value}</dd>
    </div>
  );
}

// Product/set images live in Supabase storage, not this app's own /public —
// next.config.ts has no remotePatterns for that host, so (matching
// ProductCard.tsx and the PDP) these are plain <img> tags rather than
// next/image, which would otherwise throw on an unconfigured hostname.
function ImageOrPlaceholder({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return <div className={`absolute inset-0 bg-[#eceae4] ${className ?? ""}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className ?? ""}`} />;
}

export default function SetCard({ set }: { set: JpSet }) {
  const soldOut = set.status === "sold-out";

  return (
    <article className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#e3e2dd] bg-white sm:grid-cols-[246px_minmax(0,1fr)]">
      {/* Left — mirrors the standard product card */}
      <div className="flex flex-col gap-3.5 border-b border-[#eceae4] p-4 pb-[18px] sm:border-r sm:border-b-0">
        <div className="relative aspect-square bg-white">
          <ImageOrPlaceholder src={set.boxImage} alt={`${set.name} booster box`} className="object-contain" />
          <Image
            src={ZLAP_MARK}
            alt=""
            width={40}
            height={40}
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 h-10 w-10 object-contain"
          />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-[17px] leading-tight font-medium text-[#14100a]">{set.name}</h2>
          <p
            className="text-[19px] font-bold -tracking-[0.01em]"
            style={{ color: soldOut ? "#6b6960" : "#14100a" }}
          >
            {set.boxPrice !== null ? idr(set.boxPrice) : "Price unavailable"}
          </p>
        </div>
      </div>

      {/* Right — set identity + booster box spec */}
      <div className="flex min-w-0 flex-col gap-4 bg-[#fbfbf9] px-5 py-[18px]">
        <div className="relative h-[78px] rounded-lg bg-white">
          <ImageOrPlaceholder
            src={set.logoImage}
            alt={`${set.name} set logo`}
            className="rounded-lg object-contain p-1.5"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {set.code && (
            <span className="rounded-[3px] bg-[#14100a] px-2 py-[3px] font-[family-name:var(--font-anton)] text-[11px] tracking-[0.1em] text-[#ffd23f]">
              {set.code}
            </span>
          )}
          <span
            className="text-[11px] font-bold tracking-[0.1em] uppercase"
            style={{ color: STATUS_COLOR[set.status] }}
          >
            {STATUS_LABEL[set.status]}
          </span>
        </div>

        <dl className="flex flex-col gap-2.5">
          <SpecRow label="Released" value={set.releasedAt ? releaseDate(set.releasedAt) : "—"} />
          <SpecRow label="Packs per box" value={set.packsPerBox !== null ? String(set.packsPerBox) : "—"} />
          <SpecRow label="Cards per pack" value={set.cardsPerPack !== null ? String(set.cardsPerPack) : "—"} />
          <SpecRow label="Language" value="Japanese" last />
        </dl>
      </div>

      {/* Full-width footer — spans both columns */}
      <Link
        href={set.href}
        className="flex items-center justify-between gap-3 border-t border-[#e3e2dd] px-4 py-3.5 no-underline sm:col-span-2 sm:px-5"
        style={{ color: soldOut ? "#5e5c54" : "#14100a" }}
      >
        <span className="text-base font-medium">{soldOut ? "Notify me" : "Add to cart"}</span>
        <span aria-hidden className="text-[17px]">
          →
        </span>
      </Link>
    </article>
  );
}
