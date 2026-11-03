import { describe, expect, it } from "vitest";
import { destinationFor, safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/dashboard", "/dashboard/appointments?day=2026-11-03", "/reset-password", "/dashboard#x"])("allows same-origin path %s", (v) => {
    expect(safeNext(v)).toBe(v);
  });

  it.each([
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http:/evil.com",
    "javascript:alert(1)",
    "dashboard",
    "",
    " /dashboard",
    "/dash\nboard",
    "/%2F%2Fevil.com",
    null,
    undefined,
  ])("rejects %j", (v) => {
    expect(safeNext(v)).toBe("/dashboard");
  });

  it("uses the given fallback", () => {
    expect(safeNext("//evil.com", "/login")).toBe("/login");
  });
});

describe("destinationFor (email links)", () => {
  it("sends invites and recovery to the password form", () => {
    expect(destinationFor("invite", null)).toBe("/reset-password?invite=1");
    expect(destinationFor("recovery", "/dashboard")).toBe("/reset-password");
  });
  it("honours a safe next for PKCE links and rejects unsafe ones", () => {
    expect(destinationFor(null, "/reset-password")).toBe("/reset-password");
    expect(destinationFor(null, "//evil.com")).toBe("/dashboard");
    expect(destinationFor("signup", null)).toBe("/dashboard");
  });
});
