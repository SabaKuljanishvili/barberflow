"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getI18n } from "@/i18n/server";
import { getSession, type SessionContext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient, createSupabaseServerClient, verifyPassword } from "@/lib/supabase/server";
import { freeBarbersFor } from "@/lib/booking";
import { lookupTwilioNumber } from "@/lib/voice/twilio-numbers";
import { dayAvailability, salonHours } from "@/lib/availability";
import { parseLocalDateTime, workingHoursProblem, zonedDayBounds, zonedToUtc } from "@/lib/time";
import {
  accountPasswordSchema,
  appointmentSchema,
  bookingClientSchema,
  clientSchema,
  emailChangeSchema,
  inviteSchema,
  parseIn,
  salonSettingsSchema,
  salonSettingsUpdate,
  serviceSchema,
  statusSchema,
  toFormState,
  withDateTime,
  withDialCode,
  withTime,
  type FormState,
} from "@/lib/validation";

// Server actions are public HTTP endpoints: every one re-checks the session
// and role here. RLS is the second line of defence, not the only one.

type Ctx = SessionContext & { locale: Locale; t: Dictionary };

async function withSession(managerOnly: boolean, fn: (s: Ctx) => Promise<FormState>): Promise<FormState> {
  const { locale, t } = await getI18n();
  const session = await getSession();
  if (!session) return { ok: false, message: t.actions.signedOut };
  if (managerOnly && !session.isManager) return { ok: false, message: t.actions.forbidden };
  return fn({ ...session, locale, t });
}

function dbError(t: Dictionary, code: string | undefined, fallback: string): FormState {
  if (code === "23505") return { ok: false, message: t.actions.exists };
  if (code === "23P01") return { ok: false, message: t.actions.overlap };
  if (code === "23503") return { ok: false, message: t.actions.inUse };
  if (code === "42501") return { ok: false, message: t.actions.forbidden };
  return { ok: false, message: fallback };
}

// --- Services --------------------------------------------------------------

export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, locale, t }) => {
    const parsed = parseIn(serviceSchema, Object.fromEntries(formData), locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const supabase = await createSupabaseServerClient();
    const { data: last } = await supabase.from("services").select("sort_order").eq("salon_id", salon.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("services").insert({
      salon_id: salon.id,
      name: parsed.data.name,
      price: parsed.data.price,
      duration_minutes: parsed.data.durationMinutes,
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    if (error) return dbError(t, error.code, t.actions.serviceAddFailed);
    revalidatePath("/dashboard/services");
    return { ok: true, message: fmt(t.actions.serviceAdded, { name: parsed.data.name }) };
  });
}

export async function updateService(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, locale, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    const parsed = parseIn(serviceSchema, Object.fromEntries(formData), locale);
    if (!id.success) return { ok: false, message: t.actions.invalidService };
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("services")
      .update({ name: parsed.data.name, price: parsed.data.price, duration_minutes: parsed.data.durationMinutes, active: formData.get("active") === "on" })
      .eq("id", id.data)
      .eq("salon_id", salon.id)
      .select("id");
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    revalidatePath("/dashboard/services");
    return { ok: true, message: t.actions.serviceSaved };
  });
}

/** Swaps a service with its neighbour in the voice agent's reading order. */
export async function moveService(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    const dir = formData.get("dir") === "up" ? "up" : "down";
    if (!id.success) return { ok: false, message: t.actions.invalidService };
    const supabase = await createSupabaseServerClient();
    const { data: list } = await supabase.from("services").select("id, sort_order").eq("salon_id", salon.id).order("sort_order").order("name");
    const rows = list ?? [];
    const i = rows.findIndex((r) => r.id === id.data);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return null;
    // Renumber densely so equal sort_order values (old data) can't stick.
    [rows[i], rows[j]] = [rows[j], rows[i]];
    const updates = rows.map((r, k) => ({ id: r.id, order: k + 1 })).filter((u) => rows.find((r) => r.id === u.id)?.sort_order !== u.order);
    for (const u of updates) {
      const { error } = await supabase.from("services").update({ sort_order: u.order }).eq("id", u.id).eq("salon_id", salon.id);
      if (error) return dbError(t, error.code, t.actions.updateFailed);
    }
    revalidatePath("/dashboard/services");
    return null;
  });
}

export async function deleteService(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: t.actions.invalidService };
    if (formData.get("confirm") !== "on") return { ok: false, message: t.actions.confirmFirst };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("services").delete().eq("id", id.data).eq("salon_id", salon.id);
    if (error?.code === "23503") return { ok: false, message: t.actions.inUseHide };
    if (error) return dbError(t, error.code, t.actions.serviceRemoveFailed);
    revalidatePath("/dashboard/services");
    return { ok: true, message: t.actions.serviceRemoved };
  });
}

// --- Clients ---------------------------------------------------------------

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ salon, locale, t }) => {
    const parsed = parseIn(clientSchema, { ...Object.fromEntries(formData), phoneNumber: withDialCode(formData, "phoneNumber") }, locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("clients").insert({
      salon_id: salon.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone_number: parsed.data.phoneNumber,
    });
    if (error?.code === "23505") return { ok: false, message: t.actions.clientExists };
    if (error) return dbError(t, error.code, t.actions.clientAddFailed);
    revalidatePath("/dashboard/clients");
    return { ok: true, message: fmt(t.actions.clientAdded, { name: parsed.data.firstName }) };
  });
}

const clientUpdateSchema = clientSchema.extend({
  id: z.uuid(),
  firstName: clientSchema.shape.firstName.or(z.literal("")),
  locale: z.enum(["ka", "en", ""]).optional().transform((v) => (v ? v : null)),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v ?? "").replace(/\r\n/g, "\n").trim()),
});

export async function updateClient(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ salon, locale, t }) => {
    const parsed = parseIn(clientUpdateSchema, { ...Object.fromEntries(formData), phoneNumber: withDialCode(formData, "phoneNumber") }, locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const v = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clients")
      .update({ first_name: v.firstName, last_name: v.lastName, phone_number: v.phoneNumber, locale: v.locale, notes: v.notes })
      .eq("id", v.id)
      .eq("salon_id", salon.id)
      .select("id");
    if (error?.code === "23505") return { ok: false, message: t.actions.clientExists };
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    revalidatePath(`/dashboard/clients/${v.id}`);
    return { ok: true, message: t.actions.clientSaved };
  });
}

/** Privacy deletion: the client, their appointments (FK cascade) and archived visits. Managers only. */
export async function deleteClient(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: t.actions.invalidRequest };
    if (formData.get("confirm") !== "on") return { ok: false, message: t.actions.confirmFirst };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("clients").delete().eq("id", id.data).eq("salon_id", salon.id).select("id");
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    // The archive has no FK and no delete policy; scope by salon explicitly.
    await createSupabaseAdminClient().from("appointments_archive").delete().eq("salon_id", salon.id).eq("client_id", id.data);
    revalidatePath("/dashboard", "layout");
    redirect("/dashboard/clients");
  });
}

// --- Appointments ----------------------------------------------------------

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ salon, userId, isManager, locale, t }) => {
    const raw = Object.fromEntries(formData);
    const parsed = parseIn(appointmentSchema, { ...raw, localTime: withDateTime(formData, "localTime") }, locale);
    const who = parseIn(bookingClientSchema, { ...raw, phoneNumber: withDialCode(formData, "phoneNumber") }, locale);
    // Report problems in both halves of the form at once.
    if (!parsed.success || !who.success) {
      const issues = [...(parsed.error?.issues ?? []), ...(who.error?.issues ?? [])];
      return toFormState(new z.ZodError(issues), t.validation);
    }
    // Barbers always book their own chair, so "any" means themselves.
    const staffId = parsed.data.staffId ?? (isManager ? undefined : userId);
    if (!isManager && staffId !== userId) return { ok: false, message: t.actions.ownChairOnly };

    const start = parseLocalDateTime(parsed.data.localTime, salon.timezone);
    if (start.getTime() < Date.now() - 5 * 60_000) return { ok: false, message: t.actions.futureOnly };

    const supabase = await createSupabaseServerClient();
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", parsed.data.serviceId)
      .eq("salon_id", salon.id)
      .maybeSingle();
    if (!service) return { ok: false, message: t.actions.invalidService };
    const hours = salonHours(salon);
    const problem = workingHoursProblem(start, service.duration_minutes, salon.timezone, hours);
    if (problem === "closedDay") return { ok: false, message: t.actions.closedDay };
    if (problem) return { ok: false, message: fmt(t.actions.outsideHours, { opens: salon.opens_at.slice(0, 5), closes: salon.closes_at.slice(0, 5) }) };

    // Match the client by phone (callers are created by the voice agent with
    // no name yet) or create them; no separate "add client" step.
    const client = who.data;
    const { data: found } = await supabase
      .from("clients")
      .select("id, first_name")
      .eq("salon_id", salon.id)
      .eq("phone_number", client.phoneNumber)
      .maybeSingle();
    let clientId = found?.id;
    if (found && !found.first_name && client.firstName) {
      await supabase.from("clients").update({ first_name: client.firstName, last_name: client.lastName }).eq("id", found.id).eq("salon_id", salon.id);
    }
    if (!clientId) {
      const { data: created, error } = await supabase
        .from("clients")
        .insert({ salon_id: salon.id, first_name: client.firstName, last_name: client.lastName, phone_number: client.phoneNumber })
        .select("id")
        .single();
      if (error || !created) return dbError(t, error?.code, t.actions.clientAddFailed);
      clientId = created.id;
    }

    if (staffId) {
      const { data: barber } = await supabase.from("profiles").select("active, takes_clients").eq("id", staffId).eq("salon_id", salon.id).maybeSingle();
      if (!barber?.active || !barber.takes_clients) return { ok: false, message: t.actions.barberUnavailable };
    }
    const end = new Date(start.getTime() + service.duration_minutes * 60_000);
    const candidates = staffId ? [staffId] : await freeBarbers(supabase, salon, start, end);
    if (!candidates.length) return { ok: false, message: t.actions.noBarberFree };

    // With "any barber", a concurrent booking can take a candidate's slot
    // between the check and the insert (23P01); then try the next one.
    for (const candidate of candidates) {
      const { error } = await supabase.from("appointments").insert({
        salon_id: salon.id,
        client_id: clientId,
        staff_id: candidate,
        service_id: parsed.data.serviceId,
        appointment_time: start.toISOString(),
        status: "confirmed",
        source: "dashboard",
      });
      if (error?.code === "23P01" && !staffId) continue;
      if (error) return dbError(t, error.code, t.actions.bookFailed);
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: t.actions.booked };
    }
    return { ok: false, message: t.actions.noBarberFree };
  });
}

/**
 * Free start times for the booking form on one day (salon time), from the
 * same engine as the voice agent. Barbers only see their own chair.
 */
export async function availableSlots(input: { serviceId: string; staffId: string; date: string }): Promise<{ time: string; staffIds: string[] }[] | null> {
  const session = await getSession();
  if (!session) return null;
  const { salon, userId, isManager } = session;
  const serviceId = z.uuid().safeParse(input.serviceId);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(input.date);
  const staffId = input.staffId ? z.uuid().safeParse(input.staffId) : null;
  if (!serviceId.success || !date.success || (staffId && !staffId.success)) return null;
  const wanted = staffId?.data ?? (isManager ? null : userId);
  if (!isManager && wanted !== userId) return null;

  const supabase = await createSupabaseServerClient();
  const [y, m, d] = date.data.split("-").map(Number);
  const dayStart = zonedToUtc(y, m, d, 0, 0, salon.timezone);
  const dayEnd = zonedToUtc(y, m, d + 1, 0, 0, salon.timezone);
  const [service, staff, appts] = await Promise.all([
    supabase.from("services").select("duration_minutes").eq("id", serviceId.data).eq("salon_id", salon.id).maybeSingle(),
    wanted ? Promise.resolve({ data: [{ id: wanted }] }) : supabase.from("profiles").select("id").eq("salon_id", salon.id).eq("active", true).eq("takes_clients", true),
    supabase
      .from("appointments")
      .select("staff_id, appointment_time, ends_at")
      .eq("salon_id", salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("ends_at", dayStart.toISOString())
      .lt("appointment_time", dayEnd.toISOString()),
  ]);
  if (!service.data) return null;
  const busy = appts.data ?? [];
  return dayAvailability({
    date: date.data,
    timeZone: salon.timezone,
    hours: salonHours(salon),
    durationMinutes: service.data.duration_minutes,
    now: new Date(),
    barbers: (staff.data ?? []).map((b) => ({
      id: b.id,
      busy: busy.filter((a) => a.staff_id === b.id).map((a) => ({ start: new Date(a.appointment_time), end: new Date(a.ends_at) })),
    })),
  }).map(({ time, staffIds }) => ({ time, staffIds }));
}

/** Barbers free for [start, end), least booked that salon day first. */
async function freeBarbers(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, salon: SessionContext["salon"], start: Date, end: Date) {
  const day = zonedDayBounds(start, salon.timezone);
  const [staff, appts] = await Promise.all([
    supabase.from("profiles").select("id").eq("salon_id", salon.id).eq("active", true).eq("takes_clients", true).order("full_name"),
    supabase
      .from("appointments")
      .select("staff_id, appointment_time, ends_at")
      .eq("salon_id", salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("ends_at", day.start.toISOString())
      .lt("appointment_time", day.end.toISOString()),
  ]);
  return freeBarbersFor(staff.data ?? [], appts.data ?? [], start, end);
}

export async function updateAppointmentStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ salon, t }) => {
    const parsed = statusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: t.actions.invalidRequest };
    const supabase = await createSupabaseServerClient();
    // RLS limits barbers to their own appointments; zero rows means not allowed.
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .eq("salon_id", salon.id)
      .select("id");
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: fmt(t.actions.markedAs, { status: t.status[parsed.data.status] }) };
  });
}

/** Moves an appointment to a new start (same barber and service). The DB rejects overlaps (23P01). */
export async function rescheduleAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ salon, locale, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    const when = parseIn(appointmentSchema.pick({ localTime: true }), { localTime: withDateTime(formData, "localTime") }, locale);
    if (!id.success) return { ok: false, message: t.actions.invalidRequest };
    if (!when.success) return toFormState(when.error, t.validation);
    const start = parseLocalDateTime(when.data.localTime, salon.timezone);
    if (start.getTime() < Date.now() - 5 * 60_000) return { ok: false, message: t.actions.futureOnly };

    const supabase = await createSupabaseServerClient();
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, services(duration_minutes)")
      .eq("id", id.data)
      .eq("salon_id", salon.id)
      .maybeSingle();
    if (!appt?.services) return { ok: false, message: t.actions.forbidden };
    const hours = salonHours(salon);
    const problem = workingHoursProblem(start, appt.services.duration_minutes, salon.timezone, hours);
    if (problem === "closedDay") return { ok: false, message: t.actions.closedDay };
    if (problem) return { ok: false, message: fmt(t.actions.outsideHours, { opens: salon.opens_at.slice(0, 5), closes: salon.closes_at.slice(0, 5) }) };

    // RLS limits barbers to their own appointments; zero rows means not allowed.
    const { data, error } = await supabase
      .from("appointments")
      .update({ appointment_time: start.toISOString(), reminder_sent_at: null })
      .eq("id", id.data)
      .eq("salon_id", salon.id)
      .select("id");
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: t.actions.rescheduled };
  });
}

// --- Team ------------------------------------------------------------------

export async function inviteBarber(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, locale, t }) => {
    const parsed = parseIn(inviteSchema, { ...Object.fromEntries(formData), phone: withDialCode(formData, "phone") }, locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      // Invite links open the set-password form (see /auth/confirm).
      redirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent("/reset-password?invite=1")}`,
      data: { full_name: parsed.data.fullName },
    });
    if (error || !data.user) {
      console.error("invite failed", error?.code);
      return { ok: false, message: t.actions.inviteFailed };
    }

    // salon_id comes from the manager's verified session, never from the form.
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      salon_id: salon.id,
      full_name: parsed.data.fullName,
      role: "barber",
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return dbError(t, profileError.code, t.actions.barberAddFailed);
    }
    revalidatePath("/dashboard/team");
    return { ok: true, message: fmt(t.actions.inviteSent, { email: parsed.data.email }) };
  });
}

/** Manager edits another member: role, active, takes clients. Not their own role (no lock-out). */
export async function updateStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, userId, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    const role = z.enum(["manager", "barber"]).safeParse(formData.get("role"));
    if (!id.success || !role.success) return { ok: false, message: t.actions.invalidMember };
    const self = id.data === userId;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({
        takes_clients: formData.get("takesClients") === "on",
        // A manager can't demote or deactivate themselves.
        ...(self ? {} : { role: role.data, active: formData.get("active") === "on" }),
      })
      .eq("id", id.data)
      .eq("salon_id", salon.id)
      .select("id");
    if (error) return dbError(t, error.code, t.actions.updateFailed);
    if (!data?.length) return { ok: false, message: t.actions.forbidden };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: t.actions.memberSaved };
  });
}

/** Sends the invite email again to someone who hasn't signed in yet. */
export async function resendInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: t.actions.invalidMember };
    const admin = createSupabaseAdminClient();
    const { data: member } = await admin.from("profiles").select("email, full_name").eq("id", id.data).eq("salon_id", salon.id).maybeSingle();
    if (!member) return { ok: false, message: t.actions.forbidden };
    const { error } = await admin.auth.admin.inviteUserByEmail(member.email, {
      redirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent("/reset-password?invite=1")}`,
      data: { full_name: member.full_name },
    });
    if (error) {
      console.error("invite resend failed", error.code);
      return { ok: false, message: t.actions.inviteFailed };
    }
    return { ok: true, message: fmt(t.actions.inviteSent, { email: member.email }) };
  });
}

export async function removeStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, userId, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: t.actions.invalidMember };
    if (id.data === userId) return { ok: false, message: t.actions.notYourself };

    const admin = createSupabaseAdminClient();
    const { data: member } = await admin.from("profiles").select("id").eq("id", id.data).eq("salon_id", salon.id).maybeSingle();
    if (!member) return { ok: false, message: t.actions.forbidden };

    // Removing a barber cascades their appointments, so refuse while any remain.
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", id.data)
      .eq("salon_id", salon.id);
    if (count) return { ok: false, message: fmt(t.actions.reassignFirst, { count }) };

    const { error } = await admin.auth.admin.deleteUser(id.data);
    if (error) return { ok: false, message: t.actions.memberRemoveFailed };
    revalidatePath("/dashboard/team");
    return { ok: true, message: t.actions.memberRemoved };
  });
}

// --- Settings & account -----------------------------------------------------

export async function updateSalonSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, locale, t }) => {
    const parsed = parseIn(
      salonSettingsSchema,
      {
        ...Object.fromEntries(formData),
        phoneNumber: withDialCode(formData, "phoneNumber"),
        opensAt: withTime(formData, "opensAt"),
        closesAt: withTime(formData, "closesAt"),
        workingDays: formData.getAll("workingDays"),
        closedDates: formData.getAll("closedDates").map(String),
      },
      locale,
    );
    if (!parsed.success) return toFormState(parsed.error, t.validation);

    // A new number must exist in the Twilio account, or calls and SMS never
    // reach us (a personal mobile used to be saved here). Without Twilio the
    // number is kept as is; the connection panel says Twilio is off.
    const phone = parsed.data.phoneNumber;
    if (phone && phone !== salon.phone_number) {
      const found = await lookupTwilioNumber(phone);
      if (found.kind === "missing") return { ok: false, message: t.actions.numberNotInTwilio, fieldErrors: { phoneNumber: [t.actions.numberNotInTwilio] } };
      if (found.kind === "error") return { ok: false, message: t.actions.twilioCheckFailed };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("salons").update(salonSettingsUpdate(parsed.data)).eq("id", salon.id);
    if (error?.code === "23505") return { ok: false, message: t.actions.phoneTaken };
    if (error) return dbError(t, error.code, t.actions.settingsFailed);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: t.actions.settingsSaved };
  });
}

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ userId, locale, t }) => {
    const parsed = parseIn(
      inviteSchema.pick({ fullName: true, phone: true }),
      { ...Object.fromEntries(formData), phone: withDialCode(formData, "phone") },
      locale,
    );
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null })
      .eq("id", userId);
    if (error) return dbError(t, error.code, t.actions.detailsFailed);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: t.actions.detailsSaved };
  });
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(false, async ({ userId, locale, t }) => {
    const parsed = parseIn(accountPasswordSchema, Object.fromEntries(formData), locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    // Slows guessing the current password from a hijacked session.
    if (!rateLimit(`pw-change:${userId}`, 5, 15 * 60_000).ok) return { ok: false, message: t.auth.forgot.tooMany };

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const email = typeof data?.claims.email === "string" ? data.claims.email : null;
    if (!email || !(await verifyPassword(email, parsed.data.currentPassword))) {
      return { ok: false, message: t.actions.currentPasswordWrong, fieldErrors: { currentPassword: [t.actions.currentPasswordWrong] } };
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, message: t.actions.passwordFailed };
    await supabase.auth.signOut({ scope: "others" });
    return { ok: true, message: t.actions.passwordUpdated };
  });
}

/** Managers change their own sign-in email; Supabase confirms it by email first. Barbers ask their manager. */
export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ profile, locale, t }) => {
    const parsed = parseIn(emailChangeSchema, Object.fromEntries(formData), locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const email = parsed.data.email.toLowerCase();
    if (email === profile.email.toLowerCase()) return { ok: false, message: t.actions.emailUnchanged };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${siteUrl()}/auth/confirm` });
    if (error) {
      console.error("email change failed", error.code);
      return { ok: false, message: t.actions.emailChangeFailed };
    }
    return { ok: true, message: fmt(t.actions.emailChangeSent, { email }) };
  });
}

/**
 * Deletes the whole salon: every staff login, then the salon row, which
 * cascades to services, clients, appointments and call logs. Archived visits
 * are removed by salon id. The manager must type the salon name exactly and
 * tick the confirmation. Runs with the service role after the manager check.
 */
export async function deleteSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    if (formData.get("confirm") !== "on") return { ok: false, message: t.actions.confirmFirst };
    if (String(formData.get("salonName") ?? "").trim() !== salon.name.trim()) {
      return { ok: false, message: t.actions.salonNameMismatch, fieldErrors: { salonName: [t.actions.salonNameMismatch] } };
    }
    const admin = createSupabaseAdminClient();
    const { data: staff, error: staffError } = await admin.from("profiles").select("id").eq("salon_id", salon.id);
    if (staffError) return { ok: false, message: t.actions.deleteSalonFailed };

    await admin.from("appointments_archive").delete().eq("salon_id", salon.id);
    const { error } = await admin.from("salons").delete().eq("id", salon.id);
    if (error) {
      console.error("salon delete failed", error.code);
      return { ok: false, message: t.actions.deleteSalonFailed };
    }
    // Profiles are gone with the salon; now remove the logins themselves.
    for (const s of staff ?? []) {
      const { error: userError } = await admin.auth.admin.deleteUser(s.id);
      if (userError) console.error("staff login delete failed", userError.code);
    }
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    redirect("/?deleted=1");
  });
}
