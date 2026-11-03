import "server-only";
import { INTL_LOCALE, fmt, isLocale, otherLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { dictionaryFor } from "@/i18n/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { extractFirstName, matchChoice, requestedLanguage } from "./match";
import {
  bookAppointment,
  describeService as describe,
  findOrCreateClient,
  getClient,
  getService,
  listBarbers,
  listServices,
  logCallOutcome,
  nextSlots,
  spokenDate as spoken,
  type Db,
  type Salon,
} from "./salon";
import { speak, speakableLocale } from "./tts";
import { understand, type Understanding } from "./understand";
import { VoiceResponse, twilioClient, twilioConfig, webhookUrl, type TwilioParams } from "./twilio";

// Inbound call state machine. Each step is a Twilio webhook; state travels in
// the callback URL's query string, which Twilio signs, so it cannot be forged.
// Every id is still re-checked against the salon resolved from the signed "To".
//
// Language: `l` in the query is the call's language. The first step picks it
// from the caller's saved choice, else the salon's default; pressing 0 at the
// first menu switches it and saves it on the client.
//
// Speech the keyword matcher can't place goes to Claude (understand.ts),
// which may pick the option or answer a question about the salon. Answers
// don't use up an attempt; `q` counts them so a call can't loop forever.

type Query = URLSearchParams;
type Ctx = { db: Db; salon: Salon; params: TwilioParams; query: Query; locale: Locale; t: Dictionary["voice"] };
type Twiml = InstanceType<typeof VoiceResponse>;

const MAX_ATTEMPTS = 2;
const MAX_QUESTIONS = 3;

export type Step = "incoming" | "service" | "barber" | "slot" | "name";
export const STEPS: Step[] = ["incoming", "service", "barber", "slot", "name"];

export async function handleVoiceStep(step: Step, params: TwilioParams, query: Query): Promise<string> {
  const db = createSupabaseAdminClient();
  const { data: salon, error } = await db.from("salons").select("*").eq("phone_number", params.To ?? "").maybeSingle();
  if (error) throw new Error(`salon lookup failed: ${error.message}`);

  const wanted = query.get("l");
  const locale = speakableLocale(isLocale(wanted) ? wanted : (salon?.locale ?? "ka"));

  if (!salon || !salon.voice_agent_enabled || salon.subscription_status === "cancelled") {
    console.warn("voice call not accepted", {
      step,
      to: params.To,
      reason: !salon ? "no salon has this phone_number" : !salon.voice_agent_enabled ? "voice agent disabled" : "subscription cancelled",
    });
    const r = new VoiceResponse();
    speak(r, dictionaryFor(locale).voice.unavailable, locale);
    r.hangup();
    return r.toString();
  }

  const ctx: Ctx = { db, salon, params, query, locale, t: dictionaryFor(locale).voice };
  try {
    switch (step) {
      case "incoming":
        return await incoming(ctx);
      case "service":
        return await chooseService(ctx);
      case "barber":
        return await chooseBarber(ctx);
      case "slot":
        return await chooseSlot(ctx);
      case "name":
        return await saveName(ctx);
    }
  } catch (err) {
    console.error("voice flow error", { step, salonId: salon.id, err: err instanceof Error ? err.message : err });
    await logOutcome(ctx, "error");
    const r = new VoiceResponse();
    say(ctx, r, ctx.t.techError);
    r.hangup();
    return r.toString();
  }
}

// ---------------------------------------------------------------------------

async function incoming(ctx: Ctx): Promise<string> {
  const { db, salon, params } = ctx;
  const from = params.From ?? "";
  const r = new VoiceResponse();

  if (!/^\+[1-9]\d{6,14}$/.test(from)) {
    say(ctx, r, fmt(ctx.t.hiddenNumber, { salon: salon.name }));
    r.hangup();
    return r.toString();
  }

  const client = await findOrCreateClient(ctx, from);

  // A returning caller's own language beats the salon default on the first
  // step; after that `l` is always set.
  if (!isLocale(ctx.query.get("l")) && client.locale) setLocale(ctx, speakableLocale(client.locale));

  const logged = await db
    .from("call_logs")
    .upsert(
      { salon_id: salon.id, call_sid: params.CallSid ?? crypto.randomUUID(), from_number: from, client_id: client.id },
      { onConflict: "call_sid" },
    );
  if (logged.error) console.error("call log insert failed", { salonId: salon.id, err: logged.error.message });

  const services = await listServices(ctx);
  if (!services.length) {
    say(ctx, r, fmt(ctx.t.noServices, { salon: salon.name }));
    r.hangup();
    return r.toString();
  }

  const greeting = client.first_name
    ? fmt(ctx.t.welcomeBack, { salon: salon.name, name: client.first_name })
    : fmt(ctx.t.welcome, { salon: salon.name });
  gatherMenu(ctx, r, `${greeting} ${ctx.t.canBook} ${ctx.t.whichService}`, services.map((s) => describeService(ctx, s)), url(ctx, "/api/voice/service", { c: client.id }), {
    offerLanguageSwitch: true,
  });
  return r.toString();
}

async function chooseService(ctx: Ctx): Promise<string> {
  const switchTo = requestedLanguage(input(ctx), ctx.locale);
  if (switchTo && speakableLocale(switchTo) === switchTo) return switchLanguage(ctx, switchTo);

  const services = await listServices(ctx);
  const options = services.map((s) => describeService(ctx, s));
  const choice = await resolveChoice(ctx, ctx.t.whichService, options, services.map((s) => s.name));
  if (choice.kind !== "choice") return retry(ctx, "/api/voice/service", ctx.t.whichService, options, choice);

  const service = services[choice.index];
  const barbers = await listBarbers(ctx);
  const r = new VoiceResponse();
  gatherMenu(
    ctx,
    r,
    `${fmt(ctx.t.serviceChosen, { service: service.name })} ${ctx.t.preferredBarber}`,
    [...barbers.map((b) => b.full_name), ctx.t.anyBarber],
    url(ctx, "/api/voice/barber", { c: clientId(ctx), s: service.id }),
  );
  return r.toString();
}

async function switchLanguage(ctx: Ctx, locale: Locale): Promise<string> {
  const id = clientId(ctx);
  if (id) {
    const { error } = await ctx.db.from("clients").update({ locale }).eq("id", id).eq("salon_id", ctx.salon.id);
    if (error) console.error("client locale update failed", { salonId: ctx.salon.id, err: error.message });
  }
  const r = new VoiceResponse();
  r.redirect({ method: "POST" }, webhookUrl("/api/voice/incoming", { l: locale }));
  return r.toString();
}

async function chooseBarber(ctx: Ctx): Promise<string> {
  const service = await getService(ctx, ctx.query.get("s"));
  if (!service) return restart(ctx);

  const barbers = await listBarbers(ctx);
  const options = [...barbers.map((b) => b.full_name), ctx.t.anyBarber];
  const choice = await resolveChoice(ctx, ctx.t.preferredBarber, options);
  if (choice.kind !== "choice" || Number(ctx.query.get("a") ?? "0") > MAX_ATTEMPTS) {
    return retry(ctx, "/api/voice/barber", ctx.t.preferredBarber, options, choice);
  }
  const index = choice.index;

  const chosen = index < barbers.length ? [barbers[index]] : barbers;
  const offers = await nextSlots(ctx, service, chosen, 3);
  const r = new VoiceResponse();

  if (!offers.length) {
    await logOutcome(ctx, "no_availability");
    say(ctx, r, ctx.t.noAvailability);
    r.hangup();
    return r.toString();
  }

  const names = new Map(barbers.map((b) => [b.id, b.full_name]));
  gatherMenu(
    ctx,
    r,
    ctx.t.nextSlots,
    offers.map((o) => fmt(ctx.t.slotOption, { when: spokenDate(ctx, o.start), barber: names.get(o.staffId) ?? "" })),
    url(ctx, "/api/voice/slot", {
      c: clientId(ctx),
      s: service.id,
      bd: index + 1,
      a: ctx.query.get("a") ?? undefined,
      q: ctx.query.get("q") ?? undefined,
      o: offers.map((o) => `${o.staffId}_${o.start.getTime() / 60_000}`).join(","),
    }),
  );
  return r.toString();
}

async function chooseSlot(ctx: Ctx): Promise<string> {
  const { salon } = ctx;
  const service = await getService(ctx, ctx.query.get("s"));
  const client = await getClient(ctx, clientId(ctx));
  if (!service || !client) return restart(ctx);

  const offers = (ctx.query.get("o") ?? "")
    .split(",")
    .map((raw) => raw.split("_"))
    .filter(([id, mins]) => /^[0-9a-f-]{36}$/.test(id) && /^\d+$/.test(mins))
    .map(([staffId, mins]) => ({ staffId, start: new Date(Number(mins) * 60_000) }));

  const barbers = await listBarbers(ctx);
  const names = new Map(barbers.map((b) => [b.id, b.full_name]));
  const labels = offers.map((o) => fmt(ctx.t.slotOption, { when: spokenDate(ctx, o.start), barber: names.get(o.staffId) ?? "" }));
  const choice = await resolveChoice(ctx, ctx.t.nextSlots, labels, offers.map((_, i) => `option ${i + 1}`));
  if (choice.kind !== "choice" || !offers[choice.index]) {
    const r = new VoiceResponse();
    const attempt = Number(ctx.query.get("a") ?? "0");
    if (choice.kind === "question") {
      say(ctx, r, choice.answer);
      reofferSlots(r, ctx, attempt, questions(ctx) + 1);
    } else {
      say(ctx, r, ctx.t.notUnderstood);
      reofferSlots(r, ctx, attempt + 1);
    }
    return r.toString();
  }

  const offer = offers[choice.index];
  const barber = barbers.find((b) => b.id === offer.staffId);
  if (!barber) return restart(ctx);

  const booked = await bookAppointment(ctx, { clientId: client.id, staffId: barber.id, serviceId: service.id, start: offer.start });

  const r = new VoiceResponse();
  if (!booked.ok) {
    say(ctx, r, ctx.t.slotTaken);
    reofferSlots(r, ctx, Number(ctx.query.get("a") ?? "0"));
    return r.toString();
  }

  await logOutcome(ctx, "booked", booked.id);
  const when = spokenDate(ctx, offer.start);
  const details = { salon: salon.name, service: service.name, barber: barber.full_name, when };
  await sendSms(salon, client.phone_number, fmt(dictionaryFor(ctx.locale).sms.booked, details));

  say(ctx, r, fmt(ctx.t.booked, details));
  if (!client.first_name) {
    const g = r.gather({
      input: ["speech"],
      language: sttLanguage(ctx),
      speechTimeout: "auto",
      action: url(ctx, "/api/voice/name", { c: client.id }),
      method: "POST",
    });
    say(ctx, g, ctx.t.askName);
  }
  say(ctx, r, ctx.t.thanksBye);
  r.hangup();
  return r.toString();
}

async function saveName(ctx: Ctx): Promise<string> {
  const client = await getClient(ctx, clientId(ctx));
  const name = extractFirstName(ctx.params.SpeechResult ?? "");

  if (client && name) {
    await ctx.db.from("clients").update({ first_name: name }).eq("id", client.id).eq("salon_id", ctx.salon.id);
  }
  const r = new VoiceResponse();
  say(ctx, r, name ? fmt(ctx.t.thanksName, { name }) : ctx.t.thanksBye);
  r.hangup();
  return r.toString();
}

// ---------------------------------------------------------------------------

function setLocale(ctx: Ctx, locale: Locale) {
  ctx.locale = locale;
  ctx.t = dictionaryFor(locale).voice;
}

function say(ctx: Ctx, node: Parameters<typeof speak>[0], text: string) {
  speak(node, text, ctx.locale);
}

/** Webhook URL that keeps the call's language. */
function url(ctx: Ctx, path: string, query: Record<string, string | number | undefined> = {}) {
  return webhookUrl(path, { ...query, l: ctx.locale });
}

function sttLanguage(ctx: Ctx) {
  // Twilio's typings list ka-GE for <Gather>, but as a union; INTL_LOCALE is a plain string.
  return INTL_LOCALE[ctx.locale] as "ka-GE" | "en-US";
}

function spokenDate(ctx: Ctx, date: Date) {
  return spoken(ctx.salon, ctx.locale, date);
}

function input(ctx: Ctx) {
  return { digits: ctx.params.Digits ?? ctx.query.get("d"), speech: ctx.params.SpeechResult };
}

function clientId(ctx: Ctx) {
  return ctx.query.get("c") ?? "";
}

function describeService(ctx: Ctx, s: Tables<"services">) {
  return describe(ctx.t, s);
}

function gatherMenu(ctx: Ctx, r: Twiml, prompt: string, options: string[], action: string, { offerLanguageSwitch = false } = {}) {
  const g = r.gather({
    input: ["speech", "dtmf"],
    language: sttLanguage(ctx),
    numDigits: 1,
    speechTimeout: "auto",
    timeout: 6,
    action,
    method: "POST",
    hints: options.join(", "),
  });
  const items = options.map((label, i) => fmt(ctx.t.menuItem, { n: i + 1, label }));
  say(ctx, g, [prompt, ...items].join(" "));
  if (offerLanguageSwitch) {
    // Said in the other language's own voice, so a caller who doesn't
    // understand the first one still understands this.
    const other = otherLocale(ctx.locale);
    if (speakableLocale(other) === other) speak(g, dictionaryFor(other).voice.switchHint, other);
  }
  r.redirect({ method: "POST" }, action);
}

/** Asks again. After an answered question, the answer leads and no attempt is used. */
async function retry(ctx: Ctx, path: string, prompt: string, options: string[], heard?: Understanding): Promise<string> {
  const answered = heard?.kind === "question" ? heard.answer : null;
  const attempt = Number(ctx.query.get("a") ?? "0") + (answered ? 0 : 1);
  const r = new VoiceResponse();
  if (attempt > MAX_ATTEMPTS) {
    await logOutcome(ctx, "abandoned");
    say(ctx, r, ctx.t.giveUp);
    r.hangup();
    return r.toString();
  }
  const query: Record<string, string> = Object.fromEntries(ctx.query);
  query.a = String(attempt);
  if (answered) query.q = String(questions(ctx) + 1);
  delete query.d;
  gatherMenu(ctx, r, `${answered ?? ctx.t.notUnderstood} ${prompt}`, options, url(ctx, path, query));
  return r.toString();
}

function restart(ctx: Ctx): string {
  const r = new VoiceResponse();
  say(ctx, r, ctx.t.restart);
  r.redirect({ method: "POST" }, url(ctx, "/api/voice/incoming"));
  return r.toString();
}

function reofferSlots(r: Twiml, ctx: Ctx, attempt: number, asked = questions(ctx)) {
  r.redirect(
    { method: "POST" },
    url(ctx, "/api/voice/barber", { c: clientId(ctx), s: ctx.query.get("s") ?? "", d: ctx.query.get("bd") ?? "", a: attempt, q: asked || undefined }),
  );
}

/**
 * Keypad or keyword match first; Claude only for speech that didn't match.
 * `matchLabels` are what the keyword matcher compares against, when they
 * differ from the options as spoken.
 */
async function resolveChoice(ctx: Ctx, menuPrompt: string, options: string[], matchLabels = options): Promise<Understanding> {
  const index = matchChoice(input(ctx), matchLabels);
  if (index !== null) return { kind: "choice", index };
  const speech = ctx.params.SpeechResult;
  if (!speech) return { kind: "unclear" };

  const [services, barbers] = await Promise.all([listServices(ctx), listBarbers(ctx)]);
  const heard = await understand({ facts: { salon: ctx.salon, services, barbers }, locale: ctx.locale, menuPrompt, options, speech });
  if (heard.kind === "question" && questions(ctx) >= MAX_QUESTIONS) return { kind: "unclear" };
  return heard;
}

function questions(ctx: Ctx) {
  return Number(ctx.query.get("q") ?? "0");
}

async function logOutcome(ctx: Ctx, outcome: Tables<"call_logs">["outcome"], appointmentId?: string) {
  await logCallOutcome(ctx, ctx.params.CallSid, outcome, appointmentId);
}

export async function recordCallStatus(params: TwilioParams): Promise<void> {
  const sid = params.CallSid;
  const status = params.CallStatus;
  if (!sid || !status) return;

  const db = createSupabaseAdminClient();
  const { data: salon, error } = await db.from("salons").select("id").eq("phone_number", params.To ?? "").maybeSingle();
  if (error) throw new Error(`salon lookup failed: ${error.message}`);
  if (!salon) {
    console.warn("call status for unknown number", { to: params.To, status });
    return;
  }

  const duration = Number.parseInt(params.CallDuration ?? "", 10);
  const final = ["completed", "busy", "failed", "no-answer", "canceled"].includes(status);
  const { error: upsertError } = await db.from("call_logs").upsert(
    {
      salon_id: salon.id,
      call_sid: sid,
      from_number: params.From || "unknown",
      call_status: status,
      duration_seconds: Number.isFinite(duration) ? duration : null,
      ...(final ? { ended_at: new Date().toISOString() } : {}),
    },
    { onConflict: "call_sid" },
  );
  if (upsertError) throw new Error(`call status upsert failed: ${upsertError.message}`);
}

export async function sendSms(salon: Pick<Salon, "id" | "phone_number">, to: string, body: string): Promise<boolean> {
  // No Twilio (local testing, web-only setup): bookings still work, no SMS.
  if (!salon.phone_number || !twilioConfig()) return false;
  try {
    await twilioClient().messages.create({ from: salon.phone_number, to, body });
    return true;
  } catch (err) {
    console.error("sms send failed", { salonId: salon.id, err: err instanceof Error ? err.message : err });
    return false;
  }
}
