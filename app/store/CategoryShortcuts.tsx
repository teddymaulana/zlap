"use client";

import Link from "next/link";
import type { StorefrontShortcut } from "@/lib/types";

export default function CategoryShortcuts({
  shortcuts,
  onFilterShortcut,
}: {
  shortcuts: StorefrontShortcut[];
  onFilterShortcut: (params: URLSearchParams) => void;
}) {
  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
      {shortcuts.map((s) => {
        const isStoreFilter = s.href.startsWith("/store?");
        const isExternal = /^https?:\/\//.test(s.href);

        const content = (
          <>
            {s.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image_url}
                alt={s.label}
                className="max-h-10 max-w-10 object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">
                No image
              </div>
            )}
            <span className="text-xs font-medium text-gray-700">{s.label}</span>
          </>
        );

        const className =
          "flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border bg-white px-2 py-3 text-center hover:bg-gray-50";

        if (isStoreFilter) {
          return (
            <a
              key={s.id}
              href={s.href}
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
