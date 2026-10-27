// Timezone math without a date library. Salons store an IANA timezone; all
// timestamps in the DB are UTC.

/** Matches the salons.timezone column default. */
export const DEFAULT_TIMEZONE = "Asia/Tbilisi";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday as string],
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -300 for EST). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

/** Converts a wall-clock time in `timeZone` to the UTC instant. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle DST transitions.
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60_000;
  const offset2 = tzOffsetMinutes(new Date(result), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = guess - offset * 60_000;
  }
  return new Date(result);
}

/** Parses "YYYY-MM-DDTHH:MM" (datetime-local) in `timeZone`. */
export function parseLocalDateTime(value: string, timeZone: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) throw new Error("Invalid local datetime");
  const [, y, mo, d, h, mi] = m.map(Number);
  return zonedToUtc(y, mo, d, h, mi, timeZone);
}

export function toLocalInputValue(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** `locale` is a BCP 47 tag, e.g. INTL_LOCALE[locale] from @/i18n/config. Always 24-hour. */
export function formatInZone(
  date: Date | string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {},
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23", ...opts }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

/** Start and end (exclusive) of the salon-local day containing `date`, as UTC. */
export function zonedDayBounds(date: Date, timeZone: string): { start: Date; end: Date } {
  const p = zonedParts(date, timeZone);
  const start = zonedToUtc(p.year, p.month, p.day, 0, 0, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone);
  return { start, end };
}

export type Busy = { start: Date; end: Date };

export type SlotQuery = {
  from: Date;
  timeZone: string;
  opensAt: string; // "HH:MM" or "HH:MM:SS"
  closesAt: string;
  workingDays: number[];
  durationMinutes: number;
  busy: Busy[];
  count: number;
  stepMinutes?: number;
  leadMinutes?: number;
  maxDays?: number;
};

/** Next `count` free start times for one barber, honouring hours and bookings. */
export function findOpenSlots(q: SlotQuery): Date[] {
  const step = q.stepMinutes ?? 30;
  const earliest = q.from.getTime() + (q.leadMinutes ?? 60) * 60_000;
  const [oh, om] = q.opensAt.split(":").map(Number);
  const [ch, cm] = q.closesAt.split(":").map(Number);
  const slots: Date[] = [];
  const startDay = zonedParts(q.from, q.timeZone);

  for (let d = 0; d < (q.maxDays ?? 14) && slots.length < q.count; d++) {
    const dayUtc = new Date(Date.UTC(startDay.year, startDay.month - 1, startDay.day + d));
    const y = dayUtc.getUTCFullYear();
    const m = dayUtc.getUTCMonth() + 1;
    const day = dayUtc.getUTCDate();
    const weekday = ((dayUtc.getUTCDay() + 6) % 7) + 1;
    if (!q.workingDays.includes(weekday)) continue;

    const close = zonedToUtc(y, m, day, ch, cm, q.timeZone).getTime();
    for (
      let t = zonedToUtc(y, m, day, oh, om, q.timeZone).getTime();
      t + q.durationMinutes * 60_000 <= close && slots.length < q.count;
      t += step * 60_000
    ) {
      if (t < earliest) continue;
      const end = t + q.durationMinutes * 60_000;
      const clash = q.busy.some((b) => t < b.end.getTime() && end > b.start.getTime());
      if (!clash) slots.push(new Date(t));
    }
  }
  return slots;
}

type Hours = { opensAt: string; closesAt: string; workingDays: number[] };

const minutesOfDay = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Start hours the booking form offers: opening hour up to the last start that still fits a `stepMinutes` visit. */
export function bookableHours(h: Pick<Hours, "opensAt" | "closesAt">, stepMinutes = 15): { minHour: number; maxHour: number } {
  const open = minutesOfDay(h.opensAt);
  const lastStart = Math.max(open, minutesOfDay(h.closesAt) - stepMinutes);
  return { minHour: Math.floor(open / 60), maxHour: Math.floor(lastStart / 60) };
}

/** Why a visit starting at `start` does not fit the salon's hours, or null if it does. */
export function workingHoursProblem(
  start: Date,
  durationMinutes: number,
  timeZone: string,
  h: Hours,
): "closedDay" | "outsideHours" | null {
  const p = zonedParts(start, timeZone);
  if (!h.workingDays.includes(p.weekday)) return "closedDay";
  const begin = p.hour * 60 + p.minute;
  if (begin < minutesOfDay(h.opensAt) || begin + durationMinutes > minutesOfDay(h.closesAt)) return "outsideHours";
  return null;
}

/** "GMT+4" for Asia/Tbilisi. */
export function gmtOffset(timeZone: string, date = new Date()): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((x) => x.type === "timeZoneName")?.value ?? timeZone
  );
}

/**
 * Human name for a timezone: the localized `tbilisi` label for Georgia,
 * otherwise the IANA name without underscores ("America/New York").
 */
export function timeZoneLabel(timeZone: string, tbilisi: string, date = new Date()): string {
  const name = timeZone === DEFAULT_TIMEZONE ? tbilisi : timeZone.replaceAll("_", " ");
  return `${name} (${gmtOffset(timeZone, date)})`;
}
