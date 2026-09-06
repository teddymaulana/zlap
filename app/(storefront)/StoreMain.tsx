"use client";

import { usePathname } from "next/navigation";

// Homepage and PDP get a white canvas; every other storefront route keeps
// the default gray so their own bg-gray-50 wrappers (e.g. checkout) don't
// double up against a mismatched main background.
function isWhiteBgRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/products/");
}

export default function StoreMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bg = isWhiteBgRoute(pathname) ? "bg-white" : "bg-gray-50";
  return <main className={`min-h-screen pb-16 ${bg}`}>{children}</main>;
}
