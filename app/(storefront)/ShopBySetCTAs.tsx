import Link from "next/link";
import Image from "next/image";

const LINKS = [
  { href: "/sets/jp", label: "Japanese sets", image: "/sets-jp.png" },
  { href: "/sets/en", label: "English sets", image: "/sets-en.png" },
  { href: "/sets/id", label: "Indonesian sets", image: "/sets-id.png" },
];

export default function ShopBySetCTAs() {
  return (
    <div className="mb-8">
      <h2 className="mb-3 font-[family-name:var(--font-anton)] text-xl tracking-[0.01em] text-[#14100a]">
        SHOP BY SET
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`group relative flex items-center overflow-hidden rounded-xl bg-[#eceae4] py-[26px] pr-2 pl-3 text-[#14100a] no-underline transition-colors hover:bg-[#e3e2dd] sm:pl-4 ${
              i === 0 ? "col-span-2 sm:col-span-1" : "col-span-1"
            }`}
          >
            <span className="relative z-10 flex max-w-[70%] flex-col items-start gap-2 sm:flex-row sm:items-center">
              <span className="text-xs leading-tight font-bold tracking-[0.01em] sm:text-sm">
                {link.label.split(" ").map((word, wi) => (
                  <span key={wi} className="block">
                    {word}
                  </span>
                ))}
              </span>
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd23f] transition-transform group-hover:translate-x-0.5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#14100a"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </span>
            <Image
              src={link.image}
              alt=""
              aria-hidden
              width={110}
              height={110}
              className={`pointer-events-none absolute -right-1 -bottom-2 object-contain sm:h-[92px] sm:w-[92px] ${
                i === 0 ? "h-[130px] w-[130px]" : "h-[100px] w-[100px]"
              }`}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
