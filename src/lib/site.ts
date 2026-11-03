// Labels live in the dictionaries (src/i18n); entries here carry the key.
export const site = {
  name: "DevskStudio",
} as const;

/** Public path of the brand mark (transparent star PNG). Also the structured-data logo. */
export const BRAND_MARK_SRC = "/brand/star.png";

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
