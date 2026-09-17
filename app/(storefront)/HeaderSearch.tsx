"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";

// Collapsed icon that expands into a full-width overlay across the header
// row on click, rather than a persistent input — keeps every page's header
// the same height, including the homepage (which already has its own
// full-size search bar in the body). Submitting always sends the customer
// to the homepage's search results (same "/?q=" the homepage's own search
// box uses, and the same URL its `searchParams` effect reacts to), even
// when triggered from a page — like the PDP or a set page — that has no
// search UI of its own.
export default function HeaderSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
    close();
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={copy.home.searchAria}
        className="rounded-full p-2 text-black hover:bg-gray-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-6 w-6"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center gap-2 bg-white px-4">
      <form onSubmit={handleSubmit} className="relative flex-1">
        <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500">
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
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          placeholder={copy.home.searchPlaceholder}
          className="w-full rounded bg-[#efefef] py-2 pr-3 pl-9 text-sm outline-none"
        />
      </form>
      <button
        type="button"
        onClick={close}
        aria-label={copy.header.closeSearch}
        className="shrink-0 rounded-full p-2 text-xl text-gray-500 hover:bg-gray-100"
      >
        ×
      </button>
    </div>
  );
}
