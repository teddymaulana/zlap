// Staff-only SNKRDUNK helpers for the admin product page: the "Check on
// SNKRDUNK" link, plus parsing the saved link for the PSA 10 price
// reference fetched by app/actions/snkrdunk.ts.

const SNKRDUNK_HOST = /(^|\.)snkrdunk\.com$/i;

// Accepts a pasted SNKRDUNK link, or a bare product number (the digits in
// snkrdunk.com/apparels/724996), which becomes that card's used/graded
// listings page. Returns null for an empty value and throws on anything
// that isn't a snkrdunk.com link, so a typo doesn't get saved silently.
export function normalizeSnkrdunkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return `https://snkrdunk.com/apparels/${trimmed}/used`;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("SNKRDUNK link must be a snkrdunk.com URL or product number");
  }
  if (!SNKRDUNK_HOST.test(url.hostname)) {
    throw new Error("SNKRDUNK link must be a snkrdunk.com URL or product number");
  }
  url.protocol = "https:";
  return url.toString();
}

export function snkrdunkSearchUrl(keyword: string): string {
  return `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(keyword.trim())}`;
}

// The card's number from a saved SNKRDUNK link — the same id appears in
// snkrdunk.com/apparels/{id}/used and snkrdunk.com/en/trading-cards/{id}.
export function snkrdunkApparelId(url: string | null | undefined): string | null {
  return url?.match(/\/(?:apparels|trading-cards)\/(\d+)/)?.[1] ?? null;
}
