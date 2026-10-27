// Labels live in the dictionaries (src/i18n); entries here carry the key.
export const site = {
  name: "BarberFlow",
} as const;

export const marketingNav = [
  { href: "/", key: "home" },
  { href: "/contact", key: "contact" },
  { href: "/legal", key: "legal" },
] as const;

export const legalPages = [
  { href: "/legal/privacy", key: "privacy" },
  { href: "/legal/terms", key: "terms" },
  { href: "/legal/refund", key: "refund" },
  { href: "/legal/cookies", key: "cookies" },
] as const;

export type LegalKey = (typeof legalPages)[number]["key"];

export const LEGAL_LAST_UPDATED = "2026-10-27";
