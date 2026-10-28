"use client";

import { useRef, type ReactNode } from "react";

// Pointer-driven 3D tilt with a holographic glare, like tilting a foil card
// under a light. The pointer position is written straight to CSS custom
// properties (see .zl-tilt in globals.css) instead of React state, so moving
// the mouse doesn't re-render anything. Mouse/pen only — on touch the tilt
// would fight scrolling — and turned off under prefers-reduced-motion in CSS.
export default function Tilt3D({
  children,
  className = "",
  wrapperClassName = "",
  maxTilt = 10,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  // For the outer perspective wrapper — layout classes (grid span, margins).
  wrapperClassName?: string;
  // Degrees of rotation at the element's edges.
  maxTilt?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      el.style.setProperty("--zl-rx", `${(0.5 - y) * maxTilt * 2}deg`);
      el.style.setProperty("--zl-ry", `${(x - 0.5) * maxTilt * 2}deg`);
      el.style.setProperty("--zl-gx", `${x * 100}%`);
      el.style.setProperty("--zl-gy", `${y * 100}%`);
      el.dataset.active = "";
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    el.style.setProperty("--zl-rx", "0deg");
    el.style.setProperty("--zl-ry", "0deg");
    delete el.dataset.active;
  };

  return (
    <div className={`zl-tilt-scene ${wrapperClassName}`}>
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        className={`zl-tilt ${className}`}
      >
        {children}
        {glare && <span aria-hidden className="zl-tilt-glare" />}
      </div>
    </div>
  );
}
