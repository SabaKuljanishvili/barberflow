import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { LOCALE_HEADER, localeAlternates } from "./routing";
import { ka } from "./dictionaries/ka";

export const dictionaries: Record<Locale, Dictionary> = { ka, en };

/**
 * Site language. Marketing pages: the URL (proxy.ts sets LOCALE_HEADER).
 * Elsewhere: the switcher's cookie, else Accept-Language, else Georgian.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  try {
    return negotiateLocale((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
});

export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

/** For code without a request (voice webhooks, cron): pick by stored locale. */
export function dictionaryFor(locale: string | null | undefined): Dictionary {
  return dictionaries[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/** Metadata `alternates` (self canonical + hreflang) for a marketing page in the current language. */
export async function pageAlternates(path: string) {
  return localeAlternates(await getLocale(), path);
}
