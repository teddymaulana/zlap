"use client";

import { copy, fillCopy } from "@/lib/copy";

// Page numbers to show: always the first and last page plus the current
// page's neighbours, with a gap marker ("…") wherever pages are skipped.
function pageItems(page: number, lastPage: number): (number | "gap")[] {
  const pages = new Set([1, lastPage, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  for (const p of sorted) {
    const prev = items[items.length - 1];
    if (typeof prev === "number" && p - prev > 1) items.push("gap");
    items.push(p);
  }
  return items;
}

export default function SearchPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const buttonClass =
    "flex h-9 min-w-9 items-center justify-center rounded border px-2 text-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className="text-xs text-gray-500">{fillCopy(copy.home.resultsRange, { from, to, total })}</p>
      {lastPage > 1 && (
        <nav aria-label={copy.home.paginationAria} className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={buttonClass}
          >
            {copy.home.previousPage}
          </button>
          {pageItems(page, lastPage).map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-gray-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
                className={
                  item === page
                    ? "flex h-9 min-w-9 items-center justify-center rounded border border-black bg-black px-2 text-sm text-white"
                    : buttonClass
                }
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= lastPage}
            className={buttonClass}
          >
            {copy.home.nextPage}
          </button>
        </nav>
      )}
    </div>
  );
}
