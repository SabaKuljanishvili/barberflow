import type { Dictionary } from "@/i18n/dictionaries/en";
import type { BarberColor } from "@/lib/appointments-ui";
import type { AppointmentStatus } from "@/lib/supabase/database.types";

/** The page's strings: the appointments slice plus the status names. */
export type Labels = Dictionary["dashboard"]["appointments"];
export type StatusNames = Record<AppointmentStatus, string>;

/** One appointment as the views draw it; times are salon-local. */
export type ApptVM = {
  id: string;
  staffId: string;
  clientId: string;
  serviceId: string;
  /** Salon-local "YYYY-MM-DD" and "HH:MM" of the start. */
  date: string;
  time: string;
  startMin: number;
  endMin: number;
  duration: number;
  client: string;
  phone: string;
  service: string;
  barber: string;
  color: BarberColor;
  status: AppointmentStatus;
  source: "dashboard" | "voice";
  /** Long date and time, preformatted on the server. */
  when: string;
  canEdit: boolean;
};

export type BarberVM = { id: string; name: string; initials: string; color: BarberColor; count: number };

export type ServiceVM = { id: string; name: string; duration: number; price: string };

export type Hours = { opensAt: string; closesAt: string; workingDays: number[]; closedDates: string[] };

/** Inline style for something drawn in a barber's colour (tokens.css --barber-*). */
export function colorVar(color: BarberColor): string {
  return `var(--barber-${color})`;
}
