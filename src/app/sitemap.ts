import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { localizedPath } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { LEGAL_LAST_UPDATED, legalPages } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const legalDate = new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`);
  // Marketing pages exist in both languages: one entry per language, each
  // listing the other as an hreflang alternate.
  const pages: { path: string; changeFrequency: Entry["changeFrequency"]; priority: number; lastModified?: Date }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
    { path: "/legal", changeFrequency: "yearly", priority: 0.3, lastModified: legalDate },
    ...legalPages.map((p) => ({ path: p.href, changeFrequency: "yearly" as const, priority: 0.3, lastModified: legalDate })),
  ];
  const localized: MetadataRoute.Sitemap = pages.flatMap(({ path, ...rest }) =>
    LOCALES.map((locale) => ({
      url: `${base}${localizedPath(locale, path)}`,
      ...rest,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}${localizedPath(l, path)}`])) },
    })),
  );
  return [
    ...localized,
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
