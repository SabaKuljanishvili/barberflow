import { describe, expect, it, vi } from "vitest";
import {
  barberColors,
  blockBox,
  changeStatusOptimistic,
  dateStrip,
  emptySlotStarts,
  formatDay,
  groupByDate,
  hourLabels,
  hourSpan,
  initials,
  isValidPhone,
  keepPicked,
  layoutLanes,
  listLimit,
  matchClients,
  nowOffset,
  resolvePrefill,
  resolveView,
  slotChips,
  statusReducer,
  stripStart,
  withStatus,
  type StatusEvent,
  type StatusOverrides,
} from "./appointments-ui";

describe("barber colours", () => {
  it("assigns the palette by team order and wraps after six", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const colors = barberColors(ids);
    expect(colors.get("a")).toBe("mint");
    expect(colors.get("b")).toBe("amber");
    expect(colors.get("c")).toBe("sky");
    expect(colors.get("f")).toBe("sand");
    expect(colors.get("g")).toBe("mint");
  });

  it("keeps Georgian initials out of Mtavruli", () => {
    expect(initials("qa barber")).toBe("QB");
    expect(initials("გიორგი ბერიძე")).toBe("გბ");
    expect(initials("  Nino  ")).toBe("N");
  });
});

describe("time grid", () => {
  it("rounds opening hours out to whole hours and falls back to 09–19", () => {
    expect(hourSpan("09:30:00", "18:15:00")).toEqual({ startMin: 540, endMin: 1140 });
    expect(hourSpan(null, null)).toEqual({ startMin: 540, endMin: 1140 });
    expect(hourSpan("18:00", "09:00")).toEqual({ startMin: 540, endMin: 1140 });
    expect(hourLabels({ startMin: 540, endMin: 720 })).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("positions blocks by start and duration, with a minimum height", () => {
    const span = { startMin: 540, endMin: 1140 };
    expect(blockBox(600, 660, span)).toEqual({ top: 54, height: 48 });
    expect(blockBox(600, 615, span)?.height).toBe(40);
    expect(blockBox(480, 520, span)).toBeNull();
    // Clamped at closing time.
    expect(blockBox(1110, 1200, span)).toEqual({ top: 496, height: 24 });
  });

  it("shows the now line only inside opening hours", () => {
    const span = { startMin: 540, endMin: 1140 };
    const hours = { opensAt: "09:00", closesAt: "19:00" };
    expect(nowOffset(600, hours, span)).toBe(52);
    expect(nowOffset(500, hours, span)).toBeNull();
    expect(nowOffset(1140, hours, span)).toBeNull();
    expect(nowOffset(null, hours, span)).toBeNull();
  });

  it("offers half-hour empty slots that have not passed", () => {
    expect(emptySlotStarts({ opensAt: "09:00", closesAt: "11:00" }, null)).toEqual([540, 570, 600, 630]);
    expect(emptySlotStarts({ opensAt: "09:00", closesAt: "11:00" }, 585)).toEqual([570, 600, 630]);
  });

  it("puts overlapping bookings side by side", () => {
    const out = layoutLanes([
      { id: "a", startMin: 600, endMin: 660 },
      { id: "b", startMin: 630, endMin: 690 },
      { id: "c", startMin: 700, endMin: 730 },
      { id: "d", startMin: 660, endMin: 690 },
    ]);
    const by = Object.fromEntries(out.map((o) => [o.id, [o.lane, o.lanes]]));
    expect(by.a).toEqual([0, 2]);
    expect(by.b).toEqual([1, 2]);
    expect(by.d).toEqual([0, 2]);
    expect(by.c).toEqual([0, 1]);
  });
});

describe("booking drawer slots", () => {
  const free = [
    { time: "09:00", staffIds: ["a", "b"] },
    { time: "09:15", staffIds: ["a"] },
    { time: "10:00", staffIds: ["b"] },
  ];

  it("lists every half hour that fits and marks what the engine returned", () => {
    const chips = slotChips({ opensAt: "09:00", closesAt: "11:00", durationMinutes: 60, free, staffId: "" });
    expect(chips).toEqual([
      { time: "09:00", available: true },
      { time: "09:30", available: false },
      { time: "10:00", available: true },
    ]);
  });

  it("only counts the chosen barber", () => {
    const chips = slotChips({ opensAt: "09:00", closesAt: "11:00", durationMinutes: 60, free, staffId: "a" });
    expect(chips.filter((c) => c.available).map((c) => c.time)).toEqual(["09:00"]);
  });

  it("marks everything unavailable while nothing is loaded", () => {
    const chips = slotChips({ opensAt: "09:00", closesAt: "10:00", durationMinutes: 30, free: null, staffId: "" });
    expect(chips.every((c) => !c.available)).toBe(true);
  });

  it("drops a picked time that is no longer free", () => {
    const chips = [
      { time: "09:00", available: true },
      { time: "09:30", available: false },
    ];
    expect(keepPicked("09:00", chips)).toBe("09:00");
    expect(keepPicked("09:30", chips)).toBe("");
    expect(keepPicked("12:00", chips)).toBe("");
  });

  it("builds a seven-day strip with closed days flagged", () => {
    // 2026-11-11 is a Wednesday; Sunday is off and the 13th is a closed date.
    const strip = dateStrip("2026-11-11", { workingDays: [1, 2, 3, 4, 5, 6], closedDates: ["2026-11-13"] });
    expect(strip.map((c) => c.iso)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(strip.filter((c) => c.closed).map((c) => c.iso)).toEqual(["2026-11-13", "2026-11-15"]);
  });

  it("starts the strip at a prefilled day beyond the first week", () => {
    expect(stripStart("2026-11-11", undefined)).toBe("2026-11-11");
    expect(stripStart("2026-11-11", "2026-11-17")).toBe("2026-11-11");
    expect(stripStart("2026-11-11", "2026-11-20")).toBe("2026-11-20");
    expect(stripStart("2026-11-11", "2026-11-01")).toBe("2026-11-11");
  });

  describe("prefill", () => {
    const strip = dateStrip("2026-11-11", { workingDays: [1, 2, 3, 4, 5, 6] });
    const base = { isManager: true, userId: "me", barberIds: ["a", "b"], todayIso: "2026-11-11", strip };

    it("keeps an empty-slot click's barber, date and time for a manager", () => {
      expect(resolvePrefill({ staffId: "a", date: "2026-11-12", time: "12:30" }, base)).toEqual({ staffId: "a", date: "2026-11-12", time: "12:30" });
    });

    it("always books a barber's own chair", () => {
      expect(resolvePrefill({ staffId: "a" }, { ...base, isManager: false }).staffId).toBe("me");
    });

    it("ignores unknown barbers, past dates and closed days", () => {
      expect(resolvePrefill({ staffId: "zzz", date: "2026-11-01", time: "10:00" }, base)).toEqual({ staffId: "", date: "2026-11-11", time: "" });
      expect(resolvePrefill({ date: "2026-11-15", time: "10:00" }, base)).toEqual({ staffId: "", date: "2026-11-11", time: "" });
    });
  });
});

describe("phone and client suggestions", () => {
  it("validates per country", () => {
    expect(isValidPhone("GE", "995", "555 12 34 56")).toBe(true);
    expect(isValidPhone("GE", "995", "555 12 34")).toBe(false);
    expect(isValidPhone("DE", "49", "0151 2345 6789")).toBe(true);
    expect(isValidPhone("DE", "49", "12")).toBe(false);
    expect(isValidPhone("GE", "995", "+44 7700 900123")).toBe(true);
    expect(isValidPhone("XX", undefined, "555123456")).toBe(false);
  });

  it("suggests known clients by name or phone digits", () => {
    const clients = [
      { name: "Nino Test", phone: "+995555123456" },
      { name: "გიორგი ბერიძე", phone: "+995577441020" },
    ];
    expect(matchClients(clients, { name: "nin" })).toEqual([clients[0]]);
    expect(matchClients(clients, { name: "გიორ" })).toEqual([clients[1]]);
    expect(matchClients(clients, { phone: "577 44" })).toEqual([clients[1]]);
    expect(matchClients(clients, { name: "n", phone: "55" })).toEqual([]);
  });
});

describe("optimistic status", () => {
  const rows = [
    { id: "1", status: "pending" as const },
    { id: "2", status: "confirmed" as const },
  ];

  it("shows the new status at once and settles after the save", () => {
    let state: StatusOverrides = {};
    state = statusReducer(state, { type: "set", id: "1", status: "confirmed" });
    expect(withStatus(rows, state)[0].status).toBe("confirmed");
    state = statusReducer(state, { type: "settle", id: "1" });
    expect(state).toEqual({});
  });

  it("reverts when the save fails", async () => {
    let state: StatusOverrides = {};
    const seen: StatusEvent[] = [];
    const dispatch = (e: StatusEvent) => {
      seen.push(e);
      state = statusReducer(state, e);
    };
    const save = vi.fn().mockResolvedValue({ ok: false, message: "forbidden" });
    const result = await changeStatusOptimistic(dispatch, state, "2", "no_show", save);
    expect(result).toEqual({ ok: false, message: "forbidden" });
    expect(seen.map((e) => e.type)).toEqual(["set", "revert"]);
    expect(withStatus(rows, state)[1].status).toBe("confirmed");
  });

  it("reverts to an earlier in-flight status, and when the save throws", async () => {
    let state: StatusOverrides = { "1": "confirmed" };
    const dispatch = (e: StatusEvent) => {
      state = statusReducer(state, e);
    };
    await changeStatusOptimistic(dispatch, state, "1", "cancelled", () => Promise.reject(new Error("network")));
    expect(state).toEqual({ "1": "confirmed" });
  });

  it("keeps the new status on success", async () => {
    let state: StatusOverrides = {};
    const dispatch = (e: StatusEvent) => {
      state = statusReducer(state, e);
    };
    await changeStatusOptimistic(dispatch, state, "1", "completed", async () => ({ ok: true }));
    expect(withStatus(rows, state)[0].status).toBe("completed");
  });
});

describe("URL state", () => {
  it("defaults to week on desktop and day on phones", () => {
    expect(resolveView({}, false)).toBe("week");
    expect(resolveView({}, true)).toBe("day");
    expect(resolveView({ view: "list" }, true)).toBe("list");
    expect(resolveView({ view: "bogus" }, false)).toBe("week");
  });

  it("opens the list for old status/range links", () => {
    expect(resolveView({ status: "pending" }, false)).toBe("list");
    expect(resolveView({ range: "past" }, true)).toBe("list");
  });

  it("pages the list by 50", () => {
    expect(listLimit(undefined)).toBe(50);
    expect(listLimit("100")).toBe(100);
    expect(listLimit("10")).toBe(50);
    expect(listLimit("9999")).toBe(500);
  });

  it("groups rows by day in order", () => {
    const groups = groupByDate([
      { id: 1, date: "2026-11-11" },
      { id: 2, date: "2026-11-11" },
      { id: 3, date: "2026-11-12" },
    ]);
    expect(groups.map((g) => [g.date, g.rows.length])).toEqual([
      ["2026-11-11", 2],
      ["2026-11-12", 1],
    ]);
  });
});

describe("day labels without browser ICU", () => {
  const ka = {
    weekdayShort: ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"],
    weekdayLong: ["ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი", "კვირა"],
    months: ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"],
    monthFirst: false,
  };

  it("formats like the server would", () => {
    expect(formatDay("2026-11-12", ka, "short")).toBe("ხუთ, 12 ნოემბერი");
    expect(formatDay("2026-11-15", ka, "long")).toBe("კვირა, 15 ნოემბერი");
    expect(formatDay("2026-11-16", ka, "weekday")).toBe("ორშ");
    expect(formatDay("2026-11-16", ka, "day")).toBe("16");
    expect(formatDay("2026-11-12", { ...ka, weekdayShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], months: [...ka.months.slice(0, 10), "November", "December"], monthFirst: true }, "short")).toBe("Thu, November 12");
  });
});
