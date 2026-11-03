import type { AppointmentStatus } from "./supabase/database.types";

// Server-side booking rules shared by the dashboard actions (and safe for
// the voice agents). The UI hides the same things, but a stale form or a
// crafted request must still be refused here.

/** Hidden (inactive) services keep their history but can't be booked. */
export function isBookableService(service: { active: boolean } | null | undefined): boolean {
  return service?.active === true;
}

/** Deactivated members and managers who don't take clients get no bookings or slots. */
export function isBookableBarber(member: { active: boolean; takes_clients: boolean } | null | undefined): boolean {
  return member?.active === true && member.takes_clients === true;
}

/** Only open appointments can move; finished, cancelled and no-show visits are history. */
export function canReschedule(status: AppointmentStatus): boolean {
  return status === "pending" || status === "confirmed";
}
