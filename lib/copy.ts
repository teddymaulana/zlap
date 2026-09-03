// Single source of truth for storefront UI copy — edit lib/storeCopy.json to
// change or translate text, no component changes needed.
import raw from "./storeCopy.json";

export const copy = raw;

// Fills "{token}" placeholders in a copy string with plain-text values. Only
// needed for sentences that interpolate a value but contain no JSX (e.g. a
// store name embedded mid-sentence) — most dynamic strings (prices, order
// IDs, counts) stay as template literals in the component, built around a
// static copy.* fragment, so this helper is used sparingly.
export function fillCopy(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}
