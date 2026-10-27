import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/auth/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
