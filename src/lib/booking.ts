// Picks a barber for "any available barber" bookings. Pure, so it is easy to
// test; the database's no-overlap constraint still has the final word.

type Busy = { staff_id: string; appointment_time: string; ends_at: string };

/**
 * Barbers free for the whole of [start, end), least booked that day first so
 * work spreads across the team. Ties keep the order given.
 */
export function freeBarbersFor(barbers: { id: string }[], dayAppointments: Busy[], start: Date, end: Date): string[] {
  const load = new Map<string, number>();
  const busy = new Set<string>();
  for (const a of dayAppointments) {
    load.set(a.staff_id, (load.get(a.staff_id) ?? 0) + 1);
    if (new Date(a.appointment_time) < end && new Date(a.ends_at) > start) busy.add(a.staff_id);
  }
  return barbers
    .filter((b) => !busy.has(b.id))
    .map((b, i) => ({ id: b.id, i, load: load.get(b.id) ?? 0 }))
    .sort((x, y) => x.load - y.load || x.i - y.i)
    .map((b) => b.id);
}
