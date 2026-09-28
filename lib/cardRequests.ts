// Most copies of one card a customer can ask for in a single request —
// shared by the request form and submitCardRequest (a "use server" module
// can only export async functions, so it can't live there).
export const MAX_REQUEST_QTY = 10;

// Sites a request's reference link may point to — card databases, price
// guides and marketplaces staff can actually price from. Anything else
// (and spam links) is refused. Subdomains count (www., jp., etc.).
export const REFERENCE_LINK_DOMAINS = [
  "pricecharting.com",
  "snkrdunk.com",
  "tcgplayer.com",
  "cardmarket.com",
  "ebay.com",
  "psacard.com",
  "pokemon-card.com",
  "pokemontcg.io",
  "limitlesstcg.com",
  "pkmncards.com",
  "onepiece-cardgame.com",
  "yuyu-tei.jp",
  "cardrush-pokemon.jp",
  "getcollectr.com",
];

// Empty is fine (the link is optional); otherwise it must be an http(s) URL
// on one of REFERENCE_LINK_DOMAINS.
export function isAllowedReferenceLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  return REFERENCE_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export const REFERENCE_LINK_ERROR =
  "Reference links must be from a card site like PriceCharting, SNKRDUNK, TCGplayer, Cardmarket or eBay";
