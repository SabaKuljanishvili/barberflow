// Demo data and date helpers for the landing page: the hero's booking ribbon
// and the archive scene in the features section.
import { fmt, type Locale } from "@/i18n/config";

/** A demo booking: indexes into `home.ribbons.services` / `.barbers`. */
export type Booking = { service: number; barber: number; time: string; offsetDays: number };

// [service, barber, time, days from today].
export const BOOKINGS: readonly Booking[] = [
  { service: 0, barber: 0, time: "15:30", offsetDays: 1 }, // haircut · Giorgi
  { service: 1, barber: 1, time: "16:00", offsetDays: 2 }, // beard · Luka
  { service: 2, barber: 2, time: "11:30", offsetDays: 1 }, // fade · Nika
  { service: 3, barber: 0, time: "17:00", offsetDays: 3 }, // hair + beard · Giorgi
  { service: 4, barber: 1, time: "12:00", offsetDays: 4 }, // kids' cut · Luka
  { service: 0, barber: 2, time: "18:30", offsetDays: 2 }, // haircut · Nika
  { service: 1, barber: 0, time: "10:30", offsetDays: 5 }, // beard · Giorgi
  { service: 2, barber: 1, time: "14:00", offsetDays: 6 }, // fade · Luka
];

// Hand-written: Intl's ka-GE month names differ across browsers.
export const MONTHS: Record<Locale, readonly string[]> = {
  ka: ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/**
 * "3 ნოემბერი" / "3 November": `today` (YYYY-MM-DD) plus `offsetDays`.
 * Pure calendar maths in UTC at noon, so DST never shifts the day.
 */
export function dateLabel(today: string, offsetDays: number, locale: Locale) {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays, 12));
  return `${date.getUTCDate()} ${MONTHS[locale][date.getUTCMonth()]}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The viewer's local calendar date as YYYY-MM-DD (client-side "today"). */
export function localIsoDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The calendar date in `timeZone` as YYYY-MM-DD (server-side "today"). */
export function isoDateIn(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type RibbonText = { bookedOn: string; services: readonly string[]; barbers: readonly string[] };
export type RibbonCard = { what: string; when: string; time: string };

/** The hero's booking cards: "Haircut · Giorgi", "Booked · 7 November", "15:30". */
export function ribbonCards(text: RibbonText, today: string, locale: Locale): RibbonCard[] {
  return BOOKINGS.map((b) => ({
    what: `${text.services[b.service]} · ${text.barbers[b.barber]}`,
    when: fmt(text.bookedOn, { date: dateLabel(today, b.offsetDays, locale) }),
    time: b.time,
  }));
}
