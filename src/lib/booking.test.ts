import { describe, expect, it } from "vitest";
import { freeBarbersFor } from "./booking";

const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00Z`);
const appt = (staffId: string, from: string, to: string) => ({ staff_id: staffId, appointment_time: at(from).toISOString(), ends_at: at(to).toISOString() });

describe("freeBarbersFor", () => {
  const barbers = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("skips barbers busy during the slot", () => {
    const day = [appt("a", "10:00", "11:00")];
    expect(freeBarbersFor(barbers, day, at("10:30"), at("11:00"))).toEqual(["b", "c"]);
  });

  it("treats back-to-back appointments as free", () => {
    const day = [appt("a", "09:00", "10:00"), appt("b", "11:00", "12:00")];
    expect(freeBarbersFor(barbers, day, at("10:00"), at("11:00"))).toContain("a");
    expect(freeBarbersFor(barbers, day, at("10:00"), at("11:00"))).toContain("b");
  });

  it("puts the barber with the fewest bookings that day first", () => {
    const day = [appt("a", "09:00", "09:30"), appt("a", "13:00", "13:30"), appt("b", "14:00", "14:30")];
    expect(freeBarbersFor(barbers, day, at("10:00"), at("10:30"))).toEqual(["c", "b", "a"]);
  });

  it("keeps the given order on ties", () => {
    expect(freeBarbersFor(barbers, [], at("10:00"), at("10:30"))).toEqual(["a", "b", "c"]);
  });

  it("returns nobody when everyone is busy", () => {
    const day = barbers.map((b) => appt(b.id, "10:00", "12:00"));
    expect(freeBarbersFor(barbers, day, at("11:00"), at("11:30"))).toEqual([]);
  });
});
