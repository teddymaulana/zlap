"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeaturedSet, FeaturedSetStatus } from "@/app/actions/storefront";
import NotifyMeModal from "../NotifyMeModal";

const STATUS_LABEL: Record<FeaturedSetStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "sold-out": "Sold out",
};

// All ≥4.5:1 against #fff and #fbfbf9.
const STATUS_COLOR: Record<FeaturedSetStatus, string> = {
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
      <dt className="text-[9px] font-bold tracking-[0.08em] text-[#6b6960] uppercase sm:text-[10px]">{label}</dt>
      <dd className="text-right text-[10px] font-bold text-[#14100a] sm:text-[11px]">{value}</dd>
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

export default function SetCard({ set }: { set: FeaturedSet }) {
  const soldOut = set.status === "sold-out";
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

  const ctaContent = (
    <>
      <span className="text-sm font-bold tracking-[0.02em] sm:text-base">
        {soldOut ? "Notify me" : "Add to cart"}
      </span>
      <span
        aria-hidden
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover/cta:translate-x-0.5 ${
          soldOut ? "bg-[#dedcd3]" : "bg-[#ffd23f]"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14100a"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </>
  );
  return (
    <article className="grid grid-cols-[170px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[#e3e2dd] bg-white sm:grid-cols-[310px_minmax(0,1fr)]">
      {/* Left — mirrors the standard product card */}
      <div className="flex flex-col gap-2.5 border-r border-[#eceae4] p-2.5 pb-3 sm:gap-3.5 sm:p-4 sm:pb-[18px]">
        <div className="relative aspect-square bg-white">
          <ImageOrPlaceholder src={set.boxImage} alt={set.name} className="object-contain" />
        </div>

        <div className="flex flex-col gap-1 sm:gap-2">
          <h2 className="text-[12px] leading-tight font-medium text-[#14100a] sm:text-[17px]">{set.name}</h2>
          <p
            className="text-[13px] font-bold -tracking-[0.01em] sm:text-[19px]"
            style={{ color: soldOut ? "#6b6960" : "#14100a" }}
          >
            {set.boxPrice ? idr(set.boxPrice) : "Price unavailable"}
          </p>
        </div>
      </div>

      {/* Right — set identity + booster box spec */}
      <div className="flex min-w-0 flex-col gap-3 bg-[#fbfbf9] px-3 py-3 sm:gap-4 sm:px-5 sm:py-[18px]">
        <div className="relative h-[78px] rounded-lg bg-white">
          <ImageOrPlaceholder
            src={set.logoImage}
            alt={`${set.name} set logo`}
            className="rounded-lg object-contain p-1.5"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {set.code && (
            <span className="rounded-[3px] bg-[#14100a] px-2 py-[3px] font-[family-name:var(--font-anton)] text-[9px] tracking-[0.1em] text-[#ffd23f] sm:text-[10px]">
              {set.code}
            </span>
          )}
          <span
            className="text-[9px] font-bold tracking-[0.1em] uppercase sm:text-[10px]"
            style={{ color: STATUS_COLOR[set.status] }}
          >
            {STATUS_LABEL[set.status]}
          </span>
        </div>

        <dl className="flex flex-col gap-2.5">
          <SpecRow label="Released" value={set.releasedAt ? releaseDate(set.releasedAt) : "—"} />
          <SpecRow label="Packs" value={set.packsPerBox !== null ? String(set.packsPerBox) : "—"} />
          <SpecRow label="Cards / pack" value={set.cardsPerPack !== null ? String(set.cardsPerPack) : "—"} />
          <SpecRow label="Language" value={set.language} last />
        </dl>
      </div>

      {/* Full-width footer — spans both columns */}
      {soldOut ? (
        <button
          type="button"
          onClick={() => setIsNotifyOpen(true)}
          className="group/cta col-span-2 flex items-center justify-between gap-3 bg-[#f0efe9] px-4 py-3 text-[#5e5c54] transition-colors hover:bg-[#e8e7e0] sm:px-5"
        >
          {ctaContent}
        </button>
      ) : (
        <Link
          href={set.href}
          className="group/cta col-span-2 flex items-center justify-between gap-3 bg-[#14100a] px-4 py-3 text-white no-underline transition-colors hover:bg-[#2a2318] sm:px-5"
        >
          {ctaContent}
        </Link>
      )}
      {isNotifyOpen && (
        <NotifyMeModal productId={set.productId} onClose={() => setIsNotifyOpen(false)} />
      )}
    </article>
  );
}
