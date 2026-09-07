"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

function SocialIcons() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <a
        href="https://instagram.com/zlapcard"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copy.footer.instagramAria}
        className="text-white/70 hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
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
        className="text-white/70 hover:text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M16.5 2h-3v13.5a2.5 2.5 0 1 1-2.5-2.5c.17 0 .34.01.5.04V9.96a5.5 5.5 0 1 0 5 5.47V8.5a7.46 7.46 0 0 0 4 1.17v-3a4.46 4.46 0 0 1-4-4.67z" />
        </svg>
      </a>
    </div>
  );
}

export default function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="bg-black text-xs font-medium tracking-wide text-white">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Mobile: one message at a time, auto-sliding */}
        <div className="min-w-0 flex-1 overflow-hidden sm:hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              width: `${messages.length * 100}%`,
              transform: `translateX(-${(index * 100) / messages.length}%)`,
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} className="shrink-0 text-center" style={{ width: `${100 / messages.length}%` }}>
                {msg}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: all messages in a row, separated by a rounded dot */}
        <div className="hidden flex-1 items-center justify-center gap-3 sm:flex">
          {messages.map((msg, i) => (
            <span key={i} className="flex items-center gap-3">
              {i > 0 && <span className="h-1 w-1 rounded-full bg-white/50" />}
              {msg}
            </span>
          ))}
        </div>

        <SocialIcons />
      </div>
    </div>
  );
}
