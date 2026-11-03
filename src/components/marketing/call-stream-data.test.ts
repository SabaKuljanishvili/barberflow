import { describe, expect, it } from "vitest";
import { BOOKINGS, dateLabel, isoDateIn, localIsoDate } from "./call-stream-data";

describe("dateLabel", () => {
  it("adds days to today and names the month", () => {
    expect(dateLabel("2026-11-01", 1, "ka")).toBe("2 ნოემბერი");
    expect(dateLabel("2026-11-01", 2, "en")).toBe("3 November");
  });

  it("crosses month and year boundaries", () => {
    expect(dateLabel("2026-10-30", 3, "ka")).toBe("2 ნოემბერი");
    expect(dateLabel("2026-12-30", 6, "en")).toBe("5 January");
    expect(dateLabel("2028-02-28", 1, "en")).toBe("29 February");
  });
});

describe("today helpers", () => {
  it("formats the local date as YYYY-MM-DD", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("uses the given time zone, not the server's", () => {
    // 21:30 UTC on 31 Oct is already 1 Nov in Tbilisi (UTC+4).
    const t = new Date(Date.UTC(2026, 9, 31, 21, 30));
    expect(isoDateIn("Asia/Tbilisi", t)).toBe("2026-11-01");
    expect(isoDateIn("UTC", t)).toBe("2026-10-31");
  });
});

describe("BOOKINGS", () => {
  it("only books future days, never today", () => {
    for (const b of BOOKINGS) expect(b.offsetDays).toBeGreaterThanOrEqual(1);
  });
});
