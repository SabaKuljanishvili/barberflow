import type { AppointmentStatus } from "@/lib/supabase/database.types";

// Pure helpers for the Appointments page (day/week/list views and the booking
// drawer). Everything here is deterministic so it can be unit-tested; the
// components only render what these return.

export const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled"];

// --- Barber colours ----------------------------------------------------------

/** Palette names; each maps to a `--barber-<name>` token in tokens.css. */
export const BARBER_PALETTE = ["mint", "amber", "sky", "rose", "lilac", "sand"] as const;
export type BarberColor = (typeof BARBER_PALETTE)[number];

/**
 * A stable colour per team member, by team order (the Team page's order:
 * role, then name). Nothing is stored; the same team gives the same colours.
 */
export function barberColors(teamIds: string[]): Map<string, BarberColor> {
  return new Map(teamIds.map((id, i) => [id, BARBER_PALETTE[i % BARBER_PALETTE.length]]));
}

/** Up to two initials. Georgian has no case: toUpperCase() would turn it into Mtavruli. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .replace(/\P{Script=Georgian}/gu, (c) => c.toUpperCase());
}

// --- Time grid ----------------------------------------------------------------

export const HOUR_PX = 52;
const DEFAULT_SPAN = { startMin: 9 * 60, endMin: 19 * 60 };

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(hhmm: string | null | undefined): number | null {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
}

export function hhmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** The grid's hours: opening hour (floored) to closing hour (rounded up); 09–19 without valid hours. */
export function hourSpan(opensAt?: string | null, closesAt?: string | null): { startMin: number; endMin: number } {
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  if (open === null || close === null || close <= open) return DEFAULT_SPAN;
  return { startMin: Math.floor(open / 60) * 60, endMin: Math.ceil(close / 60) * 60 };
}

export function hourLabels(span: { startMin: number; endMin: number }): string[] {
  const out: string[] = [];
  for (let m = span.startMin; m < span.endMin; m += 60) out.push(hhmm(m));
  return out;
}

export function gridHeight(span: { startMin: number; endMin: number }): number {
  return ((span.endMin - span.startMin) / 60) * HOUR_PX;
}

/** Pixel box of a booking in the grid, clamped to the visible hours. Short bookings keep a readable minimum height. */
export function blockBox(startMin: number, endMin: number, span: { startMin: number; endMin: number }, minHeight = 40) {
  const a = Math.max(startMin, span.startMin);
  const b = Math.min(endMin, span.endMin);
  if (b <= a) return null;
  const top = ((a - span.startMin) / 60) * HOUR_PX;
  const natural = ((b - a) / 60) * HOUR_PX - 4;
  const maxHeight = gridHeight(span) - top - 2;
  return { top: top + 2, height: Math.max(0, Math.min(Math.max(natural, minHeight), maxHeight)) };
}

/** Top of the "now" line in px, or null outside the opening hours. */
export function nowOffset(nowMin: number | null, hours: { opensAt?: string | null; closesAt?: string | null }, span: { startMin: number; endMin: number }) {
  const open = toMinutes(hours.opensAt);
  const close = toMinutes(hours.closesAt);
  if (nowMin === null || open === null || close === null || nowMin < open || nowMin >= close) return null;
  return ((nowMin - span.startMin) / 60) * HOUR_PX;
}

/** 30-minute starts a click can book: within opening hours and not already past. */
export function emptySlotStarts(hours: { opensAt?: string | null; closesAt?: string | null }, nowMin: number | null, step = 30): number[] {
  const open = toMinutes(hours.opensAt);
  const close = toMinutes(hours.closesAt);
  if (open === null || close === null) return [];
  const out: number[] = [];
  for (let m = Math.ceil(open / step) * step; m < close; m += step) {
    if (nowMin === null || m + step > nowMin) out.push(m);
  }
  return out;
}

/**
 * Side-by-side lanes for overlapping bookings (week view): each cluster of
 * overlapping items splits the column width evenly, first come leftmost.
 */
export function layoutLanes<T extends { startMin: number; endMin: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) c.lanes = lanes;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else laneEnds[lane] = item.endMin;
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return out;
}

// --- Booking drawer -------------------------------------------------------------

export type FreeSlot = { time: string; staffIds: string[] };
export type SlotChip = { time: string; available: boolean };

/**
 * The drawer's time chips for one day: every `step` from opening while the
 * service still ends by closing time. A chip is available only when the
 * availability engine (availableSlots, same as the voice agent) returned it,
 * for the chosen barber, or any barber when none is chosen. Past times on
 * today come back from the engine as missing, so they show as unavailable.
 */
export function slotChips(q: {
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  free: FreeSlot[] | null;
  staffId: string;
  step?: number;
}): SlotChip[] {
  const open = toMinutes(q.opensAt);
  const close = toMinutes(q.closesAt);
  if (open === null || close === null || q.durationMinutes <= 0) return [];
  const step = q.step ?? 30;
  const free = new Map((q.free ?? []).map((s) => [s.time, s.staffIds]));
  const chips: SlotChip[] = [];
  for (let m = Math.ceil(open / step) * step; m + q.durationMinutes <= close; m += step) {
    const time = hhmm(m);
    const ids = free.get(time);
    chips.push({ time, available: !!ids && (!q.staffId || ids.includes(q.staffId)) });
  }
  return chips;
}

/** Keeps a picked time only while it is still available. */
export function keepPicked(picked: string, chips: SlotChip[]): string {
  return chips.some((c) => c.time === picked && c.available) ? picked : "";
}

export type DateCell = { iso: string; closed: boolean };

/** Seven bookable days from `startIso`; closed days (weekday off or closed date) are flagged. */
export function dateStrip(startIso: string, hours: { workingDays: number[]; closedDates?: string[] }, days = 7): DateCell[] {
  const [y, m, d] = startIso.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    const iso = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
    const weekday = ((t.getUTCDay() + 6) % 7) + 1;
    return { iso, closed: !hours.workingDays.includes(weekday) || (hours.closedDates ?? []).includes(iso) };
  });
}

/** First day the strip shows: today, or the prefilled day when it is past the strip. */
export function stripStart(todayIso: string, wanted: string | undefined, days = 7): string {
  if (!wanted || wanted <= todayIso) return todayIso;
  const [y, m, d] = todayIso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, d + days - 1)).toISOString().slice(0, 10);
  return wanted > last ? wanted : todayIso;
}

/**
 * Weekday and month names from the server's ICU. Browsers (Chrome) ship
 * without Georgian locale data, so client components format dates from
 * these instead of Intl.
 */
export type DayNames = { weekdayShort: string[]; weekdayLong: string[]; months: string[]; monthFirst: boolean };

/** "ხუთ, 12 ნოემბერი" / "Thu, November 12" (`long` uses the full weekday). */
export function formatDay(iso: string, n: DayNames, style: "short" | "long" | "weekday" | "day"): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  if (style === "weekday") return n.weekdayShort[weekday];
  if (style === "day") return String(d);
  const wd = style === "long" ? n.weekdayLong[weekday] : n.weekdayShort[weekday];
  const dm = n.monthFirst ? `${n.months[m - 1]} ${d}` : `${d} ${n.months[m - 1]}`;
  return `${wd}, ${dm}`;
}

export type Prefill ={ staffId?: string; date?: string; time?: string; phone?: string; name?: string };

/**
 * What the drawer starts with. A barber always books their own chair; a
 * manager gets the clicked barber, or "any". Dates before today and days
 * that are closed fall back to the first open day of the strip.
 */
export function resolvePrefill(
  p: Prefill,
  ctx: { isManager: boolean; userId: string; barberIds: string[]; todayIso: string; strip: DateCell[] },
): { staffId: string; date: string; time: string } {
  const staffId = !ctx.isManager ? ctx.userId : p.staffId && ctx.barberIds.includes(p.staffId) ? p.staffId : "";
  const firstOpen = ctx.strip.find((c) => !c.closed)?.iso ?? ctx.todayIso;
  const wanted = p.date && p.date >= ctx.todayIso ? ctx.strip.find((c) => c.iso === p.date) : undefined;
  const date = wanted && !wanted.closed ? wanted.iso : firstOpen;
  const time = date === p.date && p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : "";
  return { staffId, date, time };
}

/** National digits without a trunk 0. */
export function nationalDigits(national: string): string {
  return national.replace(/\D/g, "").replace(/^0+/, "");
}

/**
 * Client-side check before submit (the server re-validates): Georgian
 * numbers have 9 national digits; elsewhere the full number must be a valid
 * E.164 length. A number typed with its own + prefix is checked as is.
 */
export function isValidPhone(countryIso: string, dial: string | undefined, national: string): boolean {
  const raw = national.trim();
  if (raw.startsWith("+") || raw.startsWith("00")) {
    const digits = raw.replace(/\D/g, "").replace(/^00/, "");
    return /^[1-9]\d{6,14}$/.test(digits);
  }
  const digits = nationalDigits(raw);
  if (!dial) return false;
  if (countryIso === "GE") return /^\d{9}$/.test(digits);
  return /^[1-9]\d{6,14}$/.test(dial + digits) && digits.length >= 4;
}

export type KnownClient = { name: string; phone: string };

/** Up to `limit` known clients whose name contains the typed name, or whose phone contains the typed digits (3+). */
export function matchClients(clients: KnownClient[], q: { name?: string; phone?: string }, limit = 5): KnownClient[] {
  const name = (q.name ?? "").trim().toLocaleLowerCase();
  const digits = (q.phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (name.length < 2 && digits.length < 3) return [];
  const out: KnownClient[] = [];
  for (const c of clients) {
    const byName = name.length >= 2 && c.name.toLocaleLowerCase().includes(name);
    const byPhone = digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits);
    if (byName || byPhone) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

// --- Status (optimistic) --------------------------------------------------------

export type StatusOverrides = Record<string, AppointmentStatus>;
export type StatusEvent =
  | { type: "set"; id: string; status: AppointmentStatus }
  | { type: "revert"; id: string; previous: AppointmentStatus | undefined }
  | { type: "settle"; id: string };

/**
 * Local status overrides while a save is in flight: "set" shows the new
 * status at once, "revert" restores the previous override after an error,
 * "settle" drops it once the server data has the new status.
 */
export function statusReducer(state: StatusOverrides, e: StatusEvent): StatusOverrides {
  const next = { ...state };
  if (e.type === "set") next[e.id] = e.status;
  else if (e.type === "revert" && e.previous) next[e.id] = e.previous;
  else delete next[e.id];
  return next;
}

export function withStatus<T extends { id: string; status: AppointmentStatus }>(rows: T[], overrides: StatusOverrides): T[] {
  return rows.map((r) => (overrides[r.id] && overrides[r.id] !== r.status ? { ...r, status: overrides[r.id] } : r));
}

/**
 * Runs a status change optimistically: dispatches "set", awaits the save,
 * and dispatches "revert" if it fails. Returns the server's result.
 */
export async function changeStatusOptimistic<R extends { ok: boolean }>(
  dispatch: (e: StatusEvent) => void,
  current: StatusOverrides,
  id: string,
  status: AppointmentStatus,
  save: () => Promise<R | null>,
): Promise<R | null> {
  const previous = current[id];
  dispatch({ type: "set", id, status });
  let result: R | null = null;
  try {
    result = await save();
  } catch {
    result = null;
  }
  if (!result?.ok) dispatch({ type: "revert", id, previous });
  return result;
}

// --- URL state -------------------------------------------------------------------

export const VIEWS = ["day", "week", "list"] as const;
export type View = (typeof VIEWS)[number];

/**
 * View from the URL. Old links that filter by status or range (dashboard
 * cards, header bell) mean the list. Without a view: week on desktop, day on
 * phones.
 */
export function resolveView(sp: { view?: string; status?: string; range?: string }, mobile: boolean): View {
  if (VIEWS.includes(sp.view as View)) return sp.view as View;
  if (sp.status || sp.range) return "list";
  return mobile ? "day" : "week";
}

export const LIST_PAGE = 50;

export function listLimit(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > LIST_PAGE ? Math.min(n, 500) : LIST_PAGE;
}

/** Groups rows (already sorted) by their salon-local date, keeping order. */
export function groupByDate<T extends { date: string }>(rows: T[]): { date: string; rows: T[] }[] {
  const groups: { date: string; rows: T[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last?.date === r.date) last.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  }
  return groups;
}
