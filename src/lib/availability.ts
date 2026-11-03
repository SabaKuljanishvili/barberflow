import { findOpenSlots, zonedParts, zonedToUtc, type Busy } from "./time";

// One day's bookable start times for the dashboard booking form. Built on
// findOpenSlots, the same engine the voice agents use (lib/voice/salon.ts
// nextSlots), so the form never offers a time the agent would refuse.

export type DaySlot = { start: Date; time: string; staffIds: string[] };

export type DayQuery = {
  date: string; // "YYYY-MM-DD" in the salon's timezone
  timeZone: string;
  hours: { opensAt: string; closesAt: string; workingDays: number[] };
  durationMinutes: number;
  barbers: { id: string; busy: Busy[] }[];
  now: Date;
  stepMinutes?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function dayAvailability(q: DayQuery): DaySlot[] {
  const m = q.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dayStart = zonedToUtc(y, mo, d, 0, 0, q.timeZone);
  const dayEnd = zonedToUtc(y, mo, d + 1, 0, 0, q.timeZone);
  if (dayEnd <= q.now) return [];
  const from = dayStart > q.now ? dayStart : q.now;

  const byStart = new Map<number, string[]>();
  for (const b of q.barbers) {
    const starts = findOpenSlots({
      from,
      leadMinutes: 0,
      maxDays: 1,
      count: 24 * 60,
      stepMinutes: q.stepMinutes ?? 15,
      timeZone: q.timeZone,
      opensAt: q.hours.opensAt,
      closesAt: q.hours.closesAt,
      workingDays: q.hours.workingDays,
      durationMinutes: q.durationMinutes,
      busy: b.busy,
    });
    for (const s of starts) {
      if (s >= dayEnd) continue;
      const list = byStart.get(s.getTime()) ?? [];
      list.push(b.id);
      byStart.set(s.getTime(), list);
    }
  }
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, staffIds]) => {
      const p = zonedParts(new Date(t), q.timeZone);
      return { start: new Date(t), time: `${pad(p.hour)}:${pad(p.minute)}`, staffIds };
    });
}
