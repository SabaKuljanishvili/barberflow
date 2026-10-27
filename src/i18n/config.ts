// Shared by server, client and the voice agent. No server-only imports here.

export const LOCALES = ["ka", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ka";
export const LOCALE_COOKIE = "bf_locale";

/** BCP 47 tags for Intl formatting, speech recognition and TTS. */
export const INTL_LOCALE: Record<Locale, string> = { ka: "ka-GE", en: "en-US" };
export const OG_LOCALE: Record<Locale, string> = { ka: "ka_GE", en: "en_US" };

/** Each language named in itself, as a switcher should show it. */
export const LOCALE_NAMES: Record<Locale, string> = { ka: "ქართული", en: "English" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ka" ? "en" : "ka";
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? "1");
      return { lang: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.find((x) => isLocale(x.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}

/** Fills "{name}" placeholders. Unknown placeholders are left as written. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
