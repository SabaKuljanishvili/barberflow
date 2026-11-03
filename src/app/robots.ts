import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/auth/"] }],
    // No `host`: it is a non-standard Yandex directive.
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
