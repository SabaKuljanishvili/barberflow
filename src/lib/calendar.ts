import { zonedToUtc } from "./time";

// Pure layout maths for the appointments Day and Week views.

const pad = (n: number) => String(n).padStart(2, "0");

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** ISO weekday 1 (Mon) … 7 (Sun). */
export function isoWeekday(iso: string): number {
  const [y, m, d] = parts(iso);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export function weekDates(iso: string): string[] {
  const monday = shiftDate(iso, 1 - isoWeekday(iso));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

/** Grid rows (salon-local "HH:MM" plus the UTC instant) from opening to closing. */
export function dayRows(iso: string, timeZone: string, opensAt: string, closesAt: string, stepMinutes = 30) {
  const [y, m, d] = parts(iso);
  const [oh, om] = opensAt.split(":").map(Number);
  const [ch, cm] = closesAt.split(":").map(Number);
  const rows: { time: string; start: Date }[] = [];
  for (let min = oh * 60 + om; min < ch * 60 + cm; min += stepMinutes) {
    const h = Math.floor(min / 60);
    rows.push({ time: `${pad(h)}:${pad(min % 60)}`, start: zonedToUtc(y, m, d, h, min % 60, timeZone) });
  }
  return rows;
}

/** Top and height of an appointment block, as % of the open day; clamped to it. */
export function blockPosition(start: Date, end: Date, open: Date, close: Date) {
  const span = close.getTime() - open.getTime();
  const a = Math.max(start.getTime(), open.getTime());
  const b = Math.min(end.getTime(), close.getTime());
  const round = (n: number) => Math.round(n * 100) / 100;
  return { top: round(((a - open.getTime()) / span) * 100), height: round((Math.max(0, b - a) / span) * 100) };
}
