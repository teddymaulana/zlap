import Link from "next/link";

export default function Pagination({
  page,
  pageSize,
  totalCount,
  basePath,
  paramName = "page",
  extraParams = {},
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
  paramName?: string;
  extraParams?: Record<string, string>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams(extraParams);
    params.set(paramName, String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <Link
        href={hrefFor(page - 1)}
        className={`rounded border px-3 py-1.5 ${
          page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
        }`}
      >
        Previous
      </Link>
      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>
      <Link
        href={hrefFor(page + 1)}
        className={`rounded border px-3 py-1.5 ${
          page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
        }`}
      >
        Next
      </Link>
    </div>
  );
}
