import { describe, expect, it } from "vitest";
import { dayAvailability } from "./availability";

const TZ = "Asia/Tbilisi"; // UTC+4, no DST
const hours = { opensAt: "09:00", closesAt: "12:00", workingDays: [1, 2, 3, 4, 5, 6] };
// Tue 2026-11-03 07:30 Tbilisi = 03:30 UTC
const now = new Date("2026-11-03T03:30:00Z");
const at = (hhmm: string, day = "2026-11-04") => new Date(`${day}T${hhmm}:00+04:00`);
const base = { timeZone: TZ, hours, durationMinutes: 60, now, stepMinutes: 30 };

describe("dayAvailability", () => {
  it("lists every start that fits before closing, as salon-local HH:MM", () => {
    const r = dayAvailability({ ...base, date: "2026-11-04", barbers: [{ id: "a", busy: [] }] });
    expect(r.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
    expect(r[0].staffIds).toEqual(["a"]);
  });

  it("skips times already past today", () => {
    const later = new Date("2026-11-04T06:10:00Z"); // 10:10 Tbilisi
    const r = dayAvailability({ ...base, now: later, date: "2026-11-04", barbers: [{ id: "a", busy: [] }] });
    expect(r.map((s) => s.time)).toEqual(["10:30", "11:00"]);
  });

  it("returns nothing for a past day or a closed weekday", () => {
    expect(dayAvailability({ ...base, date: "2026-11-02", barbers: [{ id: "a", busy: [] }] })).toEqual([]);
    expect(dayAvailability({ ...base, date: "2026-11-08", barbers: [{ id: "a", busy: [] }] })).toEqual([]); // Sunday
  });

  it("blocks overlaps per barber and unions barbers for 'any'", () => {
    const busyA = [{ start: at("09:00"), end: at("10:30") }];
    const r = dayAvailability({ ...base, date: "2026-11-04", barbers: [{ id: "a", busy: busyA }, { id: "b", busy: [] }] });
    const nine = r.find((s) => s.time === "09:00");
    expect(nine?.staffIds).toEqual(["b"]);
    expect(r.find((s) => s.time === "10:30")?.staffIds).toEqual(["a", "b"]);
    const onlyA = dayAvailability({ ...base, date: "2026-11-04", barbers: [{ id: "a", busy: busyA }] });
    expect(onlyA.map((s) => s.time)).toEqual(["10:30", "11:00"]);
  });

  it("rejects a malformed date", () => {
    expect(dayAvailability({ ...base, date: "nope", barbers: [{ id: "a", busy: [] }] })).toEqual([]);
  });
});
