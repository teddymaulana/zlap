"use client";

import { useEffect, useState } from "react";

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
      {/* Mobile: one message at a time, auto-sliding */}
      <div className="overflow-hidden py-2 sm:hidden">
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
      <div className="hidden items-center justify-center gap-3 py-2 sm:flex">
        {messages.map((msg, i) => (
          <span key={i} className="flex items-center gap-3">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-white/50" />}
            {msg}
          </span>
        ))}
      </div>
    </div>
  );
}
