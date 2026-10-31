"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getI18n } from "@/i18n/server";
import { getSession, type SessionContext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { freeBarbersFor } from "@/lib/booking";
import { parseLocalDateTime, workingHoursProblem, zonedDayBounds } from "@/lib/time";
import {
  appointmentSchema,
  bookingClientSchema,
  clientSchema,
  inviteSchema,
  parseIn,
  passwordChangeSchema,
  salonSettingsSchema,
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
    const { error } = await supabase.from("services").insert({
      salon_id: salon.id,
      name: parsed.data.name,
      price: parsed.data.price,
      duration_minutes: parsed.data.durationMinutes,
    });
    if (error) return dbError(t, error.code, t.actions.serviceAddFailed);
    revalidatePath("/dashboard/services");
    return { ok: true, message: fmt(t.actions.serviceAdded, { name: parsed.data.name }) };
  });
}

export async function deleteService(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, t }) => {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: t.actions.invalidService };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("services").delete().eq("id", id.data).eq("salon_id", salon.id);
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
    const hours = { opensAt: salon.opens_at, closesAt: salon.closes_at, workingDays: salon.working_days };
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
    if (found && !found.first_name) {
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

/** Barbers free for [start, end), least booked that salon day first. */
async function freeBarbers(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, salon: SessionContext["salon"], start: Date, end: Date) {
  const day = zonedDayBounds(start, salon.timezone);
  const [staff, appts] = await Promise.all([
    supabase.from("profiles").select("id").eq("salon_id", salon.id).order("full_name"),
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

// --- Team ------------------------------------------------------------------

export async function inviteBarber(_prev: FormState, formData: FormData): Promise<FormState> {
  return withSession(true, async ({ salon, locale, t }) => {
    const parsed = parseIn(inviteSchema, { ...Object.fromEntries(formData), phone: withDialCode(formData, "phone") }, locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${siteUrl()}/auth/confirm`,
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
      },
      locale,
    );
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const v = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("salons")
      .update({
        name: v.name,
        phone_number: v.phoneNumber ?? null,
        timezone: v.timezone,
        opens_at: v.opensAt,
        closes_at: v.closesAt,
        working_days: [...new Set(v.workingDays)].sort(),
        voice_agent_enabled: v.voiceAgentEnabled === "on",
        locale: v.locale,
      })
      .eq("id", salon.id);
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
  return withSession(false, async ({ locale, t }) => {
    const parsed = parseIn(passwordChangeSchema, Object.fromEntries(formData), locale);
    if (!parsed.success) return toFormState(parsed.error, t.validation);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, message: t.actions.passwordFailed };
    return { ok: true, message: t.actions.passwordUpdated };
  });
}
