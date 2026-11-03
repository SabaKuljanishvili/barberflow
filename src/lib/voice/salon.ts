import "server-only";
import { INTL_LOCALE, fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { spokenAmount } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { findOpenSlots, formatInZone } from "@/lib/time";

// Salon data and booking steps shared by both voice agents: the Twilio phone
// flow (flow.ts) and the browser one (web-flow.ts). Every query is scoped to
// the salon explicitly, because the admin client bypasses RLS.

export type Db = ReturnType<typeof createSupabaseAdminClient>;
export type Salon = Tables<"salons">;
export type SalonScope = { db: Db; salon: Salon };
export type Offer = { staffId: string; start: Date };

/** How dates are read out: weekday, day, month and time; no year. */
const SPOKEN_DATE: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", dateStyle: undefined, timeStyle: undefined };

export function spokenDate(salon: Pick<Salon, "timezone">, locale: Locale, date: Date): string {
  return formatInZone(date, salon.timezone, SPOKEN_DATE, INTL_LOCALE[locale]);
}

export function describeService(t: Dictionary["voice"], s: Tables<"services">): string {
  return fmt(t.serviceItem, { name: s.name, price: spokenAmount(s.price), minutes: s.duration_minutes });
}

export async function listServices({ db, salon }: SalonScope) {
  // The owner's order from the Services page; hidden services are never offered.
  const { data } = await db.from("services").select("*").eq("salon_id", salon.id).eq("active", true).order("sort_order").order("name").limit(9);
  return data ?? [];
}

export async function listBarbers({ db, salon }: SalonScope) {
  const { data } = await db.from("profiles").select("id, full_name").eq("salon_id", salon.id).order("full_name").limit(8);
  return data ?? [];
}

export async function getService({ db, salon }: SalonScope, id: string | null | undefined) {
  if (!id) return null;
  const { data } = await db.from("services").select("*").eq("salon_id", salon.id).eq("id", id).maybeSingle();
  return data;
}

export async function getClient({ db, salon }: SalonScope, id: string | null | undefined) {
  if (!id) return null;
  const { data } = await db.from("clients").select("*").eq("salon_id", salon.id).eq("id", id).maybeSingle();
  return data;
}

/** The salon's client with this E.164 number, created if new. */
export async function findOrCreateClient({ db, salon }: SalonScope, phone: string) {
  const found = await db.from("clients").select("*").eq("salon_id", salon.id).eq("phone_number", phone).maybeSingle();
  if (found.error) throw new Error(`client lookup failed: ${found.error.message}`);
  if (found.data) return found.data;
  const inserted = await db
    .from("clients")
    .upsert({ salon_id: salon.id, phone_number: phone }, { onConflict: "salon_id,phone_number" })
    .select("*")
    .single();
  if (inserted.error) throw new Error(`client insert failed: ${inserted.error.message}`);
  return inserted.data;
}

/**
 * The earliest `count` open slots across `barbers`, one per start time.
 * `from` moves the search window forward (a time the client asked for);
 * slots still start at least an hour from now.
 */
export async function nextSlots(
  { db, salon }: SalonScope,
  service: Pick<Tables<"services">, "duration_minutes">,
  barbers: { id: string }[],
  count: number,
  from?: Date,
): Promise<Offer[]> {
  const now = new Date();
  const lead = 60;
  // findOpenSlots adds the lead to `from`, so start an hour before the wanted time.
  const searchFrom = from ? new Date(Math.max(now.getTime(), from.getTime() - lead * 60_000)) : now;
  const horizon = new Date(searchFrom.getTime() + 15 * 86_400_000);
  const { data: busy } = await db
    .from("appointments")
    .select("staff_id, appointment_time, ends_at")
    .eq("salon_id", salon.id)
    .in("status", ["pending", "confirmed"])
    .in("staff_id", barbers.map((b) => b.id))
    .gte("ends_at", searchFrom.toISOString())
    .lt("appointment_time", horizon.toISOString());

  const all = barbers.flatMap((b) =>
    findOpenSlots({
      from: searchFrom,
      leadMinutes: lead,
      timeZone: salon.timezone,
      opensAt: salon.opens_at,
      closesAt: salon.closes_at,
      workingDays: salon.working_days,
      durationMinutes: service.duration_minutes,
      busy: (busy ?? [])
        .filter((x) => x.staff_id === b.id)
        .map((x) => ({ start: new Date(x.appointment_time), end: new Date(x.ends_at) })),
      count,
    }).map((start) => ({ staffId: b.id, start })),
  );

  const seen = new Set<number>();
  return all
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .filter((o) => !seen.has(o.start.getTime()) && seen.add(o.start.getTime()))
    .slice(0, count);
}

export type BookResult = { ok: true; id: string } | { ok: false; reason: "taken" };

/** Inserts a confirmed voice booking. The DB's exclusion constraint (23P01) catches races. */
export async function bookAppointment(
  { db, salon }: SalonScope,
  booking: { clientId: string; staffId: string; serviceId: string; start: Date },
): Promise<BookResult> {
  const { data, error } = await db
    .from("appointments")
    .insert({
      salon_id: salon.id,
      client_id: booking.clientId,
      staff_id: booking.staffId,
      service_id: booking.serviceId,
      appointment_time: booking.start.toISOString(),
      status: "confirmed",
      source: "voice",
    })
    .select("id")
    .single();
  if (error?.code === "23P01") return { ok: false, reason: "taken" };
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return { ok: true, id: data.id };
}

/** Sets a call's outcome. `callSid` is Twilio's CallSid or a web session id. */
export async function logCallOutcome(
  { db, salon }: SalonScope,
  callSid: string | undefined,
  outcome: Tables<"call_logs">["outcome"],
  appointmentId?: string,
): Promise<void> {
  if (!callSid) return;
  const { error } = await db
    .from("call_logs")
    .update({ outcome, ...(appointmentId ? { appointment_id: appointmentId } : {}) })
    .eq("call_sid", callSid)
    .eq("salon_id", salon.id);
  if (error) console.error("call outcome update failed", { salonId: salon.id, outcome, err: error.message });
}
