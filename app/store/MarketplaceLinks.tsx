import { copy } from "@/lib/copy";

export default function MarketplaceLinks() {
  return (
    <div className="border-t bg-gray-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-8">
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          {copy.marketplace.alsoShopOn}
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://shopee.co.id/zlapcollectibles"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#EE4D2D] px-5 py-3 text-white shadow-sm transition-transform hover:scale-[1.03] hover:shadow-md"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 shrink-0">
              <path d="M17 8a5 5 0 0 0-10 0H4l-1 13.5A2 2 0 0 0 5 23.5h14a2 2 0 0 0 2-2.09L20 8h-3Zm-8 0a3 3 0 1 1 6 0H9Zm-2 3a1 1 0 1 1 2 0 3 3 0 0 0 6 0 1 1 0 1 1 2 0 5 5 0 0 1-10 0Z" />
            </svg>
            <div className="leading-tight">
              <div className="text-[10px] font-medium opacity-80">{copy.marketplace.findUsOn}</div>
              <div className="text-sm font-bold">{copy.marketplace.shopee}</div>
            </div>
          </a>
          <a
            href="https://www.tokopedia.com/zlap"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#03AC0E] px-5 py-3 text-white shadow-sm transition-transform hover:scale-[1.03] hover:shadow-md"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 shrink-0">
              <path d="M12 2 3 6.5v3L12 14l9-4.5v-3L12 2Zm0 2.24 5.53 2.76L12 9.76 6.47 7 12 4.24ZM4 11.18l7 3.5v7.14l-7-3.5v-7.14Zm16 0v7.14l-7 3.5v-7.14l7-3.5Z" />
            </svg>
            <div className="leading-tight">
              <div className="text-[10px] font-medium opacity-80">{copy.marketplace.findUsOn}</div>
              <div className="text-sm font-bold">{copy.marketplace.tokopedia}</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
