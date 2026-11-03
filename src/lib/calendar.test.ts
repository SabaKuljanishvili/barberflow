import { describe, expect, it } from "vitest";
import { blockPosition, dayRows, shiftDate, weekDates } from "./calendar";

describe("calendar helpers", () => {
  it("shifts ISO dates across month ends", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("gives Monday-first weeks", () => {
    expect(weekDates("2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(weekDates("2026-11-08")[0]).toBe("2026-11-02");
  });
  it("lists rows from opening to closing in salon time", () => {
    const rows = dayRows("2026-11-04", "Asia/Tbilisi", "09:00", "11:00", 30);
    expect(rows.map((r) => r.time)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
    expect(rows[0].start.toISOString()).toBe("2026-11-04T05:00:00.000Z");
  });
  it("positions a block as percentages of the open day, clamped", () => {
    const open = new Date("2026-11-04T05:00:00Z");
    const close = new Date("2026-11-04T07:00:00Z");
    expect(blockPosition(new Date("2026-11-04T05:30:00Z"), new Date("2026-11-04T06:30:00Z"), open, close)).toEqual({ top: 25, height: 50 });
    expect(blockPosition(new Date("2026-11-04T04:00:00Z"), new Date("2026-11-04T05:30:00Z"), open, close)).toEqual({ top: 0, height: 25 });
  });
});
