import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./env";

describe("resolveSiteUrl", () => {
  it("keeps only the origin (a stray path broke canonical, OG and sitemap URLs)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://barberflow-six-nu.vercel.app/login" })).toBe("https://barberflow-six-nu.vercel.app");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://devsk.ge/" })).toBe("https://devsk.ge");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://devsk.ge/a/b?x=1#y" })).toBe("https://devsk.ge");
  });

  it("falls back to Vercel's production URL, then the deployment URL, then localhost", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app", VERCEL_URL: "x-123.vercel.app" })).toBe("https://app.vercel.app");
    expect(resolveSiteUrl({ VERCEL_URL: "x-123.vercel.app" })).toBe("https://x-123.vercel.app");
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("skips a malformed value instead of throwing", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "not a url", VERCEL_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: " " })).toBe("http://localhost:3000");
  });
});
