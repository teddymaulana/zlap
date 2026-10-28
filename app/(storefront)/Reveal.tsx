"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Fades and tips a section up into place the first time it scrolls into
// view (.zl-reveal in globals.css). Only for below-the-fold content — the
// section stays hidden until this hydrates.
export default function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = "";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`zl-reveal ${className}`}>
      {children}
    </div>
  );
}
