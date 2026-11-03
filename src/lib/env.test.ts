import { describe, expect, it } from "vitest";
import { resolveAppUrl, resolveSiteUrl } from "./env";

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

describe("resolveAppUrl (links that must come back to this deployment)", () => {
  const prod = { NEXT_PUBLIC_SITE_URL: "https://devsk.ge", VERCEL_PROJECT_PRODUCTION_URL: "devsk.ge" };
  it("uses the preview's own URL on preview deployments", () => {
    expect(resolveAppUrl({ ...prod, VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "app-git-qa-team.vercel.app", VERCEL_URL: "app-abc123-team.vercel.app" })).toBe("https://app-git-qa-team.vercel.app");
    expect(resolveAppUrl({ ...prod, VERCEL_ENV: "preview", VERCEL_URL: "app-abc123-team.vercel.app" })).toBe("https://app-abc123-team.vercel.app");
  });
  it("uses the site URL in production and locally", () => {
    expect(resolveAppUrl({ ...prod, VERCEL_ENV: "production", VERCEL_URL: "app-abc123-team.vercel.app" })).toBe("https://devsk.ge");
    expect(resolveAppUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });
  it("falls back to the site URL when a preview has no URL", () => {
    expect(resolveAppUrl({ ...prod, VERCEL_ENV: "preview" })).toBe("https://devsk.ge");
  });
});
