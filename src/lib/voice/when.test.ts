import { describe, expect, it } from "vitest";
import { parseWhen, resolveWhen, toHour24 } from "./when";

const hours = { timeZone: "Asia/Tbilisi", opensAt: "10:00", closesAt: "20:00" };
// Sunday 2026-11-01, 12:00 in Tbilisi (UTC+4).
const now = new Date("2026-11-01T08:00:00Z");

describe("parseWhen", () => {
  it("reads the Georgian example request", () => {
    const { when, rest } = parseWhen("ხვალ ორ საათზე მინდა ჩაწერა სმისთვის");
    expect(when).toEqual({ day: { offset: 1 }, time: { hour: 2, minute: 0 }, meridiem: null });
    expect(rest).toBe("მინდა ჩაწერა სმისთვის");
  });

  it("reads Georgian half hours as the previous hour plus 30", () => {
    expect(parseWhen("ზეგ ორის ნახევარზე").when?.time).toEqual({ hour: 1, minute: 30 });
    expect(parseWhen("ათის ნახევარზე").when?.time).toEqual({ hour: 9, minute: 30 });
    expect(parseWhen("სამ საათსა და ნახევარზე").when?.time).toEqual({ hour: 3, minute: 30 });
  });

  it("reads weekdays, clock times and parts of day", () => {
    expect(parseWhen("პარასკევს 15:30").when).toEqual({ day: { weekday: 5 }, time: { hour: 15, minute: 30 }, meridiem: null });
    expect(parseWhen("შაბათს დილის ათზე").when).toEqual({ day: { weekday: 6 }, time: { hour: 10, minute: 0 }, meridiem: "am" });
    expect(parseWhen("ორშაბათს").when).toEqual({ day: { weekday: 1 }, time: null, meridiem: null });
    expect(parseWhen("ხვალ 14-ზე").when?.time).toEqual({ hour: 14, minute: 0 });
    expect(parseWhen("რვა საათზე").when?.time).toEqual({ hour: 8, minute: 0 });
  });

  it("reads English requests", () => {
    expect(parseWhen("tomorrow at 2pm please").when).toEqual({ day: { offset: 1 }, time: { hour: 2, minute: 0 }, meridiem: "pm" });
    expect(parseWhen("day after tomorrow, half past three").when).toEqual({ day: { offset: 2 }, time: { hour: 3, minute: 30 }, meridiem: null });
    expect(parseWhen("friday two thirty").when).toEqual({ day: { weekday: 5 }, time: { hour: 2, minute: 30 }, meridiem: null });
    expect(parseWhen("skin fade tomorrow").rest).toBe("skin fade");
  });

  it("does not take a menu answer for a time", () => {
    expect(parseWhen("მეორე").when).toBeNull();
    expect(parseWhen("ორზე").when).toBeNull();
    expect(parseWhen("ორი").when).toBeNull();
    expect(parseWhen("the second one").when).toBeNull();
    expect(parseWhen("წვერის კორექცია").when).toBeNull();
  });

  it("takes a bare number as a time once a day was said", () => {
    expect(parseWhen("ხვალ ორზე").when?.time).toEqual({ hour: 2, minute: 0 });
    expect(parseWhen("ხვალ ორზე").rest).toBe("");
  });
});

describe("toHour24", () => {
  it("picks the hour inside opening hours", () => {
    expect(toHour24(2, 0, null, hours)).toBe(14);
    expect(toHour24(11, 0, null, hours)).toBe(11);
    expect(toHour24(7, 0, null, hours)).toBe(19);
    expect(toHour24(9, 0, null, hours)).toBe(9);
    expect(toHour24(16, 0, null, hours)).toBe(16);
    expect(toHour24(10, 0, "pm", hours)).toBe(22);
    expect(toHour24(12, 0, "am", hours)).toBe(0);
  });
});

describe("resolveWhen", () => {
  it("resolves tomorrow at 2 to 14:00 local", () => {
    const r = resolveWhen(parseWhen("ხვალ ორ საათზე").when!, now, hours);
    expect(r.exact).toBe(true);
    expect(r.start.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  });

  it("uses opening time when only a day was said", () => {
    const r = resolveWhen(parseWhen("ზეგ").when!, now, hours);
    expect(r).toEqual({ start: new Date("2026-11-03T06:00:00.000Z"), exact: false });
  });

  it("moves a time already past today to tomorrow", () => {
    expect(resolveWhen(parseWhen("11:00").when!, now, hours).start.toISOString()).toBe("2026-11-02T07:00:00.000Z");
    expect(resolveWhen(parseWhen("ხუთ საათზე").when!, now, hours).start.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });

  it("finds the next weekday, a week ahead when it is today and past", () => {
    expect(resolveWhen(parseWhen("ხუთშაბათს").when!, now, hours).start.toISOString()).toBe("2026-11-05T06:00:00.000Z");
    expect(resolveWhen(parseWhen("კვირას").when!, now, hours).start.toISOString()).toBe("2026-11-08T06:00:00.000Z");
    expect(resolveWhen(parseWhen("კვირას ხუთ საათზე").when!, now, hours).start.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });
});
