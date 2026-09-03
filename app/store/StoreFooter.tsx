import Link from "next/link";
import { copy } from "@/lib/copy";

const WHATSAPP_NUMBER = "6285121369155";
const WHATSAPP_DISPLAY = "+62 851-2136-9155";
const INSTAGRAM_HANDLE = "@zlapcard";
const CONTACT_EMAIL = "info@zlapcard.com";

export default function StoreFooter() {
  return (
    <footer className="border-t border-gray-800 bg-[#151515] text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <span className="text-sm font-bold tracking-wide">{copy.common.brandName}</span>
            <p className="mt-2 text-xs text-gray-400">{copy.footer.aboutDescription}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 sm:gap-x-12">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
                {copy.footer.shopHeading}
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-xs text-gray-400">
                <li>
                  <Link href="/store?category=slabs" className="hover:text-white">
                    {copy.filters.categories.slabs}
                  </Link>
                </li>
                <li>
                  <Link href="/store?category=booster_boxes" className="hover:text-white">
                    {copy.filters.categories.boosterBoxes}
                  </Link>
                </li>
                <li>
                  <Link href="/store/request" className="hover:text-white">
                    {copy.footer.requestACard}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
                {copy.footer.supportHeading}
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-xs text-gray-400">
                <li>
                  <Link href="/store/privacy" className="hover:text-white">
                    {copy.footer.privacy}
                  </Link>
                </li>
                <li>
                  <Link href="/store/terms" className="hover:text-white">
                    {copy.footer.terms}
                  </Link>
                </li>
                <li>
                  <Link href="/store/refund" className="hover:text-white">
                    {copy.footer.refund}
                  </Link>
                </li>
                <li>
                  <Link href="/store/faq" className="hover:text-white">
                    {copy.footer.faq}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
                {copy.footer.contactHeading}
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-xs text-gray-400">
                <li>
                  {copy.footer.emailLabel}:{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li>
                  {copy.footer.waLabel}:{" "}
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    {WHATSAPP_DISPLAY}
                  </a>
                </li>
                <li>
                  {copy.footer.instagramLabel}:{" "}
                  <a
                    href="https://instagram.com/zlapcard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    {INSTAGRAM_HANDLE}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-gray-800 pt-8">
          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/zlapcard"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.footer.instagramAria}
              className="text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
              </svg>
            </a>
            <a
              href="https://tiktok.com/@zlap.collectibles"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.footer.tiktokAria}
              className="text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M16.5 2h-3v13.5a2.5 2.5 0 1 1-2.5-2.5c.17 0 .34.01.5.04V9.96a5.5 5.5 0 1 0 5 5.47V8.5a7.46 7.46 0 0 0 4 1.17v-3a4.46 4.46 0 0 1-4-4.67z" />
              </svg>
            </a>
            <a
              href="https://wa.me/6285121369155"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.footer.whatsappAria}
              className="text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.03.32-3.42-.72-2.9-1.26-4.76-4.24-4.9-4.44-.14-.2-1.17-1.56-1.17-2.97s.73-2.1 1-2.39c.24-.26.53-.32.71-.32.18 0 .35 0 .5.01.17.01.38-.06.6.45.24.55.8 1.9.87 2.04.07.14.11.3.02.49-.09.19-.14.3-.27.46-.14.16-.28.36-.4.48-.14.13-.28.28-.12.55.16.27.71 1.16 1.52 1.88 1.05.93 1.93 1.22 2.2 1.36.27.14.43.12.59-.07.16-.19.68-.79.87-1.06.18-.27.36-.22.6-.13.24.08 1.55.73 1.82.87.27.13.44.2.5.31.07.12.07.66-.17 1.34Z" />
              </svg>
            </a>
          </div>
          <p className="text-xs text-gray-400">
            {new Date().getFullYear()} {copy.footer.copyrightBrand}
          </p>
        </div>
      </div>
    </footer>
  );
}
