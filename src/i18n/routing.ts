// Locale in the URL for marketing pages: Georgian at "/", English under
// "/en". proxy.ts rewrites "/en/..." onto the same pages and passes the
// language in LOCALE_HEADER. Dashboard and auth pages stay cookie-based.
// No server-only imports: used by proxy, server and client code.
import { DEFAULT_LOCALE, type Locale } from "./config";

export const LOCALE_HEADER = "x-bf-locale";

export const MARKETING_PATHS = [
  "/",
  "/contact",
  "/pricing",
  "/legal",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refund",
  "/legal/cookies",
] as const;

export function isMarketingPath(path: string): boolean {
  return (MARKETING_PATHS as readonly string[]).includes(path);
}

/** "/en/contact" -> { locale: "en", path: "/contact" }; null without a locale prefix. */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } | null {
  const m = pathname.match(/^\/(en|ka)(\/.*)?$/);
  if (!m) return null;
  return { locale: m[1] as Locale, path: m[2] || "/" };
}

/** The public URL of a marketing path in a language. Other paths are returned as is. */
export function localizedPath(locale: Locale, href: string): string {
  const m = href.match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || "/";
  const rest = m?.[2] ?? "";
  if (locale === DEFAULT_LOCALE || !isMarketingPath(path)) return href;
  return `${path === "/" ? "/en" : `/en${path}`}${rest}`;
}

/** Metadata `alternates` for a marketing page: self canonical + hreflang. */
export function localeAlternates(locale: Locale, path: string) {
  return {
    canonical: localizedPath(locale, path),
    languages: { ka: localizedPath("ka", path), en: localizedPath("en", path), "x-default": localizedPath("ka", path) },
  };
}
