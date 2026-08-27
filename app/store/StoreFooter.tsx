export default function StoreFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-8">
        <span className="text-sm font-bold tracking-wide">ZLAP CARD</span>
        <div className="flex items-center gap-4">
          <a
            href="https://instagram.com/zlapcard"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-gray-500 hover:text-black"
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
            aria-label="TikTok"
            className="text-gray-500 hover:text-black"
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
            aria-label="WhatsApp"
            className="text-gray-500 hover:text-black"
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
        <p className="text-xs text-gray-400">{new Date().getFullYear()} Zlap Collectibles</p>
      </div>
    </footer>
  );
}
