import { describe, expect, it } from "vitest";
import { canReschedule, isBookableBarber, isBookableService } from "./booking-rules";

describe("isBookableService", () => {
  it("only active services can be booked", () => {
    expect(isBookableService({ active: true })).toBe(true);
    expect(isBookableService({ active: false })).toBe(false);
    expect(isBookableService(null)).toBe(false);
  });
});

describe("isBookableBarber", () => {
  it("needs an active member who takes clients", () => {
    expect(isBookableBarber({ active: true, takes_clients: true })).toBe(true);
    expect(isBookableBarber({ active: false, takes_clients: true })).toBe(false);
    expect(isBookableBarber({ active: true, takes_clients: false })).toBe(false);
    expect(isBookableBarber(null)).toBe(false);
  });
});

describe("canReschedule", () => {
  it("only open appointments can move", () => {
    expect(canReschedule("pending")).toBe(true);
    expect(canReschedule("confirmed")).toBe(true);
    for (const s of ["completed", "cancelled", "no_show"] as const) expect(canReschedule(s)).toBe(false);
  });
});
