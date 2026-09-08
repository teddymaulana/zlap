import { ZLAP_LOADER_SVG } from "./ZlapLoaderSvg";

// "Chasing light" wordmark loader — see ~/Downloads/logo-loading-handsoff
// for the design handoff. White-on-dark mark, so it only reads on a dark
// ground; below ~100px the wordmark stops reading, so this isn't meant for
// tiny inline spots (a plain spinner is still fine there).
export default function ZlapLoader({
  size = 180,
  label,
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}>
      <div
        className="zl-loader"
        style={{ width: size }}
        // eslint-disable-next-line react/no-danger -- inlining is required so the CSS chase animation (globals.css) can target the nine g.zl-letter groups; see ZlapLoaderSvg.ts
        dangerouslySetInnerHTML={{ __html: ZLAP_LOADER_SVG }}
      />
      {label && <p className="zl-caption">{label}</p>}
    </div>
  );
}
