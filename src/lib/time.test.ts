import { describe, expect, it } from "vitest";
import { bookableHours, findOpenSlots, formatInZone, parseLocalDateTime, timeZoneLabel, workingHoursProblem, toLocalInputValue, zonedDayBounds, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts New York winter wall time", () => {
    expect(zonedToUtc(2026, 1, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });
  it("converts New York summer wall time", () => {
    expect(zonedToUtc(2026, 7, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
  it("handles the day after DST starts", () => {
    // DST began 2026-03-08 in the US.
    expect(zonedToUtc(2026, 3, 9, 9, 0, "America/New_York").toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });
  it("handles positive offsets", () => {
    expect(zonedToUtc(2026, 1, 15, 9, 30, "Asia/Kolkata").toISOString()).toBe("2026-01-15T04:00:00.000Z");
  });
});

describe("local input round trip", () => {
  it("parses and formats datetime-local values", () => {
    const d = parseLocalDateTime("2026-11-02T15:45", "Europe/London");
    expect(d.toISOString()).toBe("2026-11-02T15:45:00.000Z");
    expect(toLocalInputValue(d, "Europe/London")).toBe("2026-11-02T15:45");
  });
  it("rejects malformed values", () => {
    expect(() => parseLocalDateTime("2026-11-02 15:45", "UTC")).toThrow();
  });
});

describe("zonedDayBounds", () => {
  it("returns the salon-local day", () => {
    const { start, end } = zonedDayBounds(new Date("2026-01-15T03:00:00Z"), "America/New_York");
    expect(start.toISOString()).toBe("2026-01-14T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});

describe("findOpenSlots", () => {
  const base = {
    timeZone: "UTC",
    opensAt: "09:00:00",
    closesAt: "12:00:00",
    workingDays: [1, 2, 3, 4, 5],
    durationMinutes: 30,
    count: 3,
    leadMinutes: 0,
  };

  it("returns the first open slots of the day", () => {
    // 2026-10-26 is a Monday.
    const slots = findOpenSlots({ ...base, from: new Date("2026-10-26T07:00:00Z"), busy: [] });
    expect(slots.map((s) => s.toISOString())).toEqual([
      "2026-10-26T09:00:00.000Z",
      "2026-10-26T09:30:00.000Z",
      "2026-10-26T10:00:00.000Z",
    ]);
  });

  it("skips busy periods and partial overlaps", () => {
    const slots = findOpenSlots({
      ...base,
      from: new Date("2026-10-26T07:00:00Z"),
      busy: [{ start: new Date("2026-10-26T09:15:00Z"), end: new Date("2026-10-26T10:00:00Z") }],
    });
    expect(slots[0].toISOString()).toBe("2026-10-26T10:00:00.000Z");
  });

  it("never starts a slot that would run past closing", () => {
    const slots = findOpenSlots({ ...base, durationMinutes: 60, count: 10, from: new Date("2026-10-26T07:00:00Z"), busy: [] });
    const monday = slots.filter((s) => s.toISOString().startsWith("2026-10-26"));
    expect(monday.at(-1)!.toISOString()).toBe("2026-10-26T11:00:00.000Z");
  });

  it("skips closed days", () => {
    // Saturday morning: next working day is Monday.
    const slots = findOpenSlots({ ...base, count: 1, from: new Date("2026-10-31T07:00:00Z"), busy: [] });
    expect(slots[0].toISOString()).toBe("2026-11-02T09:00:00.000Z");
  });

  it("respects lead time", () => {
    const slots = findOpenSlots({ ...base, leadMinutes: 60, count: 1, from: new Date("2026-10-26T09:10:00Z"), busy: [] });
    expect(slots[0].toISOString()).toBe("2026-10-26T10:30:00.000Z");
  });
});

describe("formatInZone", () => {
  it("always uses a 24-hour clock", () => {
    const d = "2026-11-02T15:45:00Z";
    for (const locale of ["en-US", "ka-GE"]) {
      const s = formatInZone(d, "UTC", { dateStyle: undefined }, locale);
      expect(s).toContain("15:45");
      expect(s).not.toMatch(/AM|PM/);
    }
  });
});

describe("working hours", () => {
  const hours = { opensAt: "09:00:00", closesAt: "19:00:00", workingDays: [1, 2, 3, 4, 5, 6] };
  it("offers only start hours inside opening hours", () => {
    expect(bookableHours(hours)).toEqual({ minHour: 9, maxHour: 18 });
    expect(bookableHours({ opensAt: "10:30", closesAt: "20:45" })).toEqual({ minHour: 10, maxHour: 20 });
  });
  it("rejects visits outside hours or on closed days", () => {
    // 2026-11-02 is a Monday; Tbilisi is UTC+4.
    const at = (hhmm: string) => parseLocalDateTime(`2026-11-02T${hhmm}`, "Asia/Tbilisi");
    expect(workingHoursProblem(at("09:00"), 30, "Asia/Tbilisi", hours)).toBeNull();
    expect(workingHoursProblem(at("18:30"), 30, "Asia/Tbilisi", hours)).toBeNull();
    expect(workingHoursProblem(at("18:45"), 30, "Asia/Tbilisi", hours)).toBe("outsideHours");
    expect(workingHoursProblem(at("08:45"), 30, "Asia/Tbilisi", hours)).toBe("outsideHours");
    expect(workingHoursProblem(at("23:00"), 30, "Asia/Tbilisi", hours)).toBe("outsideHours");
    const sunday = parseLocalDateTime("2026-11-08T12:00", "Asia/Tbilisi");
    expect(workingHoursProblem(sunday, 30, "Asia/Tbilisi", hours)).toBe("closedDay");
  });
  it("labels timezones naturally", () => {
    expect(timeZoneLabel("Asia/Tbilisi", "თბილისი")).toBe("თბილისი (GMT+4)");
    expect(timeZoneLabel("America/New_York", "Tbilisi", new Date("2026-01-15T12:00:00Z"))).toBe("America/New York (GMT-5)");
  });
});
