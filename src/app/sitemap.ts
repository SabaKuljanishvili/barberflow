import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { LEGAL_LAST_UPDATED, legalPages } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const legalDate = new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal`, lastModified: legalDate, changeFrequency: "yearly", priority: 0.3 },
    ...legalPages.map((p) => ({
      url: `${base}${p.href}`,
      lastModified: legalDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
