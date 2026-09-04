"use client";

import Link from "next/link";
import type { StorefrontShortcut } from "@/lib/types";
import { copy } from "@/lib/copy";

export default function CategoryShortcuts({
  shortcuts,
  onFilterShortcut,
  activeSearch,
}: {
  shortcuts: StorefrontShortcut[];
  onFilterShortcut: (params: URLSearchParams) => void;
  // Canonical query string (from the page's currently applied query/filters)
  // to compare each filter-shortcut's own params against, so the shortcut
  // that produced the current results can be highlighted.
  activeSearch?: string;
}) {
  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto px-1 pt-4 pb-1">
      {shortcuts.map((s) => {
        const isStoreFilter = s.href.startsWith("/?");
        const isExternal = /^https?:\/\//.test(s.href);
        const isActive =
          isStoreFilter &&
          !!activeSearch &&
          new URLSearchParams(s.href.split("?")[1] ?? "").toString() === activeSearch;

        const badgeEl =
          s.badge === "fire" ? (
            <svg
              viewBox="0 0 16 16"
              fill="#f97316"
              className="absolute -top-2.5 -right-2.5 h-7 w-7 drop-shadow"
            >
              <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16Zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15Z" />
            </svg>
          ) : s.badge ? (
            <span
              className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow ${
                s.badge === "new" ? "bg-blue-600" : "bg-red-600"
              }`}
            >
              {s.badge === "new" ? copy.filters.badgeNew : copy.filters.badgeSale}
            </span>
          ) : null;

        const content = (
          <>
            {badgeEl}
            {s.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image_url}
                alt={s.label}
                className="max-h-10 max-w-10 object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">
                {copy.common.noImage}
              </div>
            )}
            <span
              className={`line-clamp-2 text-[10px] leading-tight font-medium ${
                isActive ? "text-black" : "text-gray-700"
              }`}
            >
              {s.label}
            </span>
          </>
        );

        const className = `relative flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-gray-200 px-2 py-3 text-center hover:bg-gray-50 ${
          isActive ? "bg-gray-100" : "bg-white"
        }`;

        if (isStoreFilter) {
          return (
            <a
              key={s.id}
              href={s.href}
              aria-current={isActive ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onFilterShortcut(new URLSearchParams(s.href.split("?")[1] ?? ""));
              }}
              className={className}
            >
              {content}
            </a>
          );
        }

        if (isExternal) {
          return (
            <a
              key={s.id}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <Link key={s.id} href={s.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
