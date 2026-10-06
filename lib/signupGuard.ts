// Shared signup checks for the web (app/actions/customer.ts signUpCustomer)
// and mobile (app/api/mobile/auth/signup) flows. Added after a Sept 2026 bot
// wave that registered ~90 accounts with real strangers' emails (email
// bombing — every signup sends them a verification email from us). Every one
// of those had a random 10-digit US-style phone, and many used Gmail's
// "dots are ignored" trick to sign one inbox up several times.

// Indonesian mobile numbers: 08xxxxxxxx (10–13 digits), or the same with
// +62 / 62 in place of the leading 0. Spaces, dashes and parens are ignored.
// Returns the number normalized to the 08… form, or null if it doesn't fit.
export function normalizeIndonesianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  const local = digits.startsWith("+62")
    ? `0${digits.slice(3)}`
    : digits.startsWith("62")
      ? `0${digits.slice(2)}`
      : digits;
  return /^08\d{8,11}$/.test(local) ? local : null;
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
// Real Gmail addresses rarely have more than a couple of dots ("first.last",
// "first.m.last"); the bot addresses had 4–10 ("u.pi.l.ey.u.r54").
const MAX_GMAIL_DOTS = 2;

export type SignupCheck = { error: string } | { error: null; phone: string | null };

export function checkSignup(input: { email: string; phone: string; honeypot?: string }): SignupCheck {
  // Hidden field on the web form (see account/signup/page.tsx) that a person
  // never sees, so anything in it came from a bot filling every input.
  if (input.honeypot) return { error: "Unable to create account. Please try again." };

  const [localPart, domain] = input.email.split("@");
  if (!localPart || !domain) return { error: "Please enter a valid email address" };
  if (GMAIL_DOMAINS.has(domain) && (localPart.match(/\./g)?.length ?? 0) > MAX_GMAIL_DOTS) {
    return { error: "Please enter a valid email address" };
  }

  if (!input.phone) return { error: null, phone: null };
  const phone = normalizeIndonesianPhone(input.phone);
  if (!phone) return { error: "Please enter an Indonesian phone number, e.g. 0812xxxxxxxx" };
  return { error: null, phone };
}
