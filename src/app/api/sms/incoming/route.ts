import { INTL_LOCALE, fmt, isLocale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { parseReply } from "@/lib/sms";
import { formatInZone } from "@/lib/time";
import { MessagingResponse, twiml, verifyTwilioRequest } from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";

// Handles "C" / "X" replies to confirmation and reminder texts.
// STOP/HELP keywords are handled by Twilio before reaching us.
export async function POST(request: Request) {
  const verified = await verifyTwilioRequest(request);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { From = "", To = "", Body = "" } = verified.params;

  const reply = new MessagingResponse();
  const action = parseReply(Body);
  const db = createSupabaseAdminClient();

  const { data: salon } = await db.from("salons").select("id, name, timezone, locale").eq("phone_number", To).maybeSingle();
  const { data: client } = salon
    ? await db.from("clients").select("id, locale").eq("salon_id", salon.id).eq("phone_number", From).maybeSingle()
    : { data: null };

  // Reply in the client's language, else the salon's.
  const locale = isLocale(client?.locale) ? client.locale : isLocale(salon?.locale) ? salon.locale : "ka";
  const sms = dictionaryFor(locale).sms;

  if (!salon || !client || !action) {
    if (salon) reply.message(fmt(sms.help, { salon: salon.name }));
    return twiml(reply.toString());
  }

  const { data: next } = await db
    .from("appointments")
    .select("id, appointment_time")
    .eq("salon_id", salon.id)
    .eq("client_id", client.id)
    .in("status", ["pending", "confirmed"])
    .gt("appointment_time", new Date().toISOString())
    .order("appointment_time")
    .limit(1)
    .maybeSingle();

  if (!next) {
    reply.message(fmt(sms.notFound, { salon: salon.name }));
    return twiml(reply.toString());
  }

  await db.from("appointments").update({ status: action }).eq("id", next.id).eq("salon_id", salon.id);
  const when = formatInZone(next.appointment_time, salon.timezone, {}, INTL_LOCALE[locale]);
  reply.message(fmt(action === "confirmed" ? sms.confirmed : sms.cancelled, { salon: salon.name, when }));
  return twiml(reply.toString());
}
