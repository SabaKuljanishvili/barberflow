import { describe, expect, it } from "vitest";
import { isMarketingPath, localeAlternates, localizedPath, splitLocalePath } from "./routing";

describe("isMarketingPath", () => {
  it.each(["/", "/contact", "/pricing", "/legal", "/legal/privacy", "/legal/cookies"])("%s is marketing", (p) => {
    expect(isMarketingPath(p)).toBe(true);
  });
  it.each(["/login", "/dashboard", "/api/voice", "/legal/nope", "/en", "/contactx"])("%s is not", (p) => {
    expect(isMarketingPath(p)).toBe(false);
  });
});

describe("localizedPath", () => {
  it("keeps Georgian unprefixed and prefixes English", () => {
    expect(localizedPath("ka", "/contact")).toBe("/contact");
    expect(localizedPath("en", "/contact")).toBe("/en/contact");
    expect(localizedPath("en", "/")).toBe("/en");
  });
  it("keeps hash and query, and leaves non-marketing paths alone", () => {
    expect(localizedPath("en", "/#features")).toBe("/en#features");
    expect(localizedPath("en", "/contact?x=1")).toBe("/en/contact?x=1");
    expect(localizedPath("en", "/signup")).toBe("/signup");
  });
});

describe("splitLocalePath", () => {
  it("reads the /en prefix", () => {
    expect(splitLocalePath("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocalePath("/en/legal/terms")).toEqual({ locale: "en", path: "/legal/terms" });
    expect(splitLocalePath("/ka/contact")).toEqual({ locale: "ka", path: "/contact" });
  });
  it("returns null without a prefix", () => {
    expect(splitLocalePath("/contact")).toBeNull();
    expect(splitLocalePath("/english")).toBeNull();
  });
});

describe("localeAlternates", () => {
  it("gives a self canonical plus hreflang for both languages", () => {
    expect(localeAlternates("en", "/contact")).toEqual({
      canonical: "/en/contact",
      languages: { ka: "/contact", en: "/en/contact", "x-default": "/contact" },
    });
    expect(localeAlternates("ka", "/").canonical).toBe("/");
  });
});
