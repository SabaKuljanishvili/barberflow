import "server-only";
import { INTL_LOCALE, fmt, isLocale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatInZone } from "@/lib/time";
import { sendSms } from "@/lib/voice/flow";

export const REMINDER_WINDOW = { fromMinutes: 60, toMinutes: 120 };

/**
 * Texts every client whose appointment starts 1-2 hours from now. Each row is
 * claimed with a conditional update first, so overlapping cron runs can never
 * double-send.
 */
export async function sendDueReminders(now = new Date()) {
  const db = createSupabaseAdminClient();
  const from = new Date(now.getTime() + REMINDER_WINDOW.fromMinutes * 60_000).toISOString();
  const to = new Date(now.getTime() + REMINDER_WINDOW.toMinutes * 60_000).toISOString();

  const { data: due, error } = await db
    .from("appointments")
    .select("id, salon_id, appointment_time, status, clients(phone_number, first_name, locale), services(name), salons(name, phone_number, timezone, subscription_status, locale)")
    .in("status", ["pending", "confirmed"])
    .is("reminder_sent_at", null)
    .gte("appointment_time", from)
    .lte("appointment_time", to)
    .limit(500);
  if (error) throw new Error(error.message);

  let sent = 0;
  let skipped = 0;
  for (const appt of due ?? []) {
    const salon = appt.salons;
    const client = appt.clients;
    if (!salon?.phone_number || !client || salon.subscription_status === "cancelled") {
      skipped++;
      continue;
    }

    const { data: claimed } = await db
      .from("appointments")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", appt.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    // The client's own language (chosen on a call) beats the salon default.
    const locale = isLocale(client.locale) ? client.locale : isLocale(salon.locale) ? salon.locale : "ka";
    const sms = dictionaryFor(locale).sms;
    const when = formatInZone(appt.appointment_time, salon.timezone, { dateStyle: undefined, timeStyle: "short" }, INTL_LOCALE[locale]);
    const ask = appt.status === "pending" ? sms.askPending : sms.askConfirmed;
    const greeting = client.first_name ? fmt(sms.greeting, { name: client.first_name }) : "";
    const ok = await sendSms(
      { id: appt.salon_id, phone_number: salon.phone_number },
      client.phone_number,
      fmt(sms.reminder, { greeting, service: appt.services?.name ?? sms.yourAppointment, salon: salon.name, when, ask }),
    );
    if (ok) sent++;
    else {
      // Release the claim so the next run retries.
      await db.from("appointments").update({ reminder_sent_at: null }).eq("id", appt.id);
      skipped++;
    }
  }
  return { scanned: due?.length ?? 0, sent, skipped };
}
