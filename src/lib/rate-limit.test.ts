import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("ip:/login", 3, 60_000, now).ok).toBe(true);
    expect(rateLimit("ip:/login", 3, 60_000, now).ok).toBe(false);
  });

  it("resets after the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) rateLimit("ip:/login", 3, 60_000, now);
    expect(rateLimit("ip:/login", 3, 60_000, now + 60_001).ok).toBe(true);
  });

  it("keys are independent", () => {
    rateLimit("a", 1, 60_000, 0);
    expect(rateLimit("a", 1, 60_000, 0).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, 0).ok).toBe(true);
  });
});
