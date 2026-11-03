import "server-only";
import { INTL_LOCALE, fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { dictionaryFor } from "@/i18n/server";
import { serverEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { formatInZone } from "@/lib/time";
import { sendSms } from "./flow";
import { extractFirstName, isAffirmative, matchChoice, matchLabel, requestedLanguage } from "./match";
import {
  bookAppointment,
  describeService,
  findOrCreateClient,
  getClient,
  getService,
  listBarbers,
  listServices,
  logCallOutcome,
  nextSlots,
  spokenDate,
  type Salon,
  type SalonScope,
} from "./salon";
import { understand, type Understanding } from "./understand";
import { decodeState, encodeState, SESSION_MS, type WebState } from "./web-state";
import { parseWhen, resolveWhen } from "./when";

// Browser voice agent: the same booking state machine as the phone flow
// (flow.ts), driven by POSTs from the dashboard instead of Twilio webhooks.
// Speech arrives as text (Azure STT or the browser's recognizer), each reply
// goes back as text plus options, and the route adds Azure TTS audio.
//
// Same rules as the phone agent: keyword matching first, the LLM only for
// speech that didn't match (it maps to an option or answers a question), and
// only this code offers times and books. On top of the phone flow, a client
// can say the day and time up front ("ხვალ ორ საათზე"); when.ts reads that
// deterministically and the slot search starts there.

const MAX_ATTEMPTS = 3;
const MAX_QUESTIONS = 3;
const MAX_INPUT = 300;

export type WebBooking = { id: string; service: string; barber: string; when: string; start: string };

export type WebTurn = {
  /** What the agent says, as shown in the transcript. */
  text: string;
  /** The same plus the options read out, for text-to-speech. */
  speech: string;
  /** Options to show as buttons; null keeps the previous ones. */
  options: string[] | null;
  /** Token for the next turn; null when the conversation is over. */
  state: string | null;
  locale: Locale;
  booking?: WebBooking;
};

export type WebInput = { text: string; choice: number | null };

type Ctx = SalonScope & { state: WebState; locale: Locale; t: Dictionary["voice"]; text: string; rest: string; choice: number | null; saidWhen: boolean; timeOnly: boolean };

/** Signing key for state tokens. Derived, so no extra secret to configure. */
function secret(): string {
  return `web-voice:${serverEnv().SUPABASE_SERVICE_ROLE_KEY}`;
}

/** Why a salon can't take web voice bookings, or null when it can. */
export function unavailableReason(salon: Pick<Salon, "voice_agent_enabled" | "subscription_status">): "disabled" | "cancelled" | null {
  if (salon.subscription_status === "cancelled") return "cancelled";
  if (!salon.voice_agent_enabled) return "disabled";
  return null;
}

export async function startWebSession(salon: Salon, phone: string, locale: Locale): Promise<WebTurn> {
  const db = createSupabaseAdminClient();
  const client = await findOrCreateClient({ db, salon }, phone);
  const sid = `web-${crypto.randomUUID()}`;
  const logged = await db.from("call_logs").insert({ salon_id: salon.id, call_sid: sid, from_number: phone, client_id: client.id, call_status: "web" });
  if (logged.error) console.error("web voice log insert failed", { salonId: salon.id, err: logged.error.message });

  const state: WebState = { salon: salon.id, sid, client: client.id, l: locale, step: "service", a: 0, q: 0, exp: Date.now() + SESSION_MS };
  const ctx = context(db, salon, state, { text: "", choice: null });
  const services = await listServices(ctx);
  if (!services.length) return end(ctx, fmt(ctx.t.web.noServices, { salon: salon.name }));

  const greeting = client.first_name ? fmt(ctx.t.welcomeBack, { salon: salon.name, name: client.first_name }) : fmt(ctx.t.welcome, { salon: salon.name });
  return ask(ctx, `${greeting} ${ctx.t.canBook} ${ctx.t.whichService}`, services.map((s) => describeService(ctx.t, s)), ctx.t.web.timeHint);
}

/** Next turn, or null when the token is invalid, expired or for another salon. */
export async function continueWebSession(salon: Salon, token: string, input: WebInput): Promise<WebTurn | null> {
  const state = decodeState(token, secret());
  if (!state || state.salon !== salon.id) return null;

  const db = createSupabaseAdminClient();
  const ctx = context(db, salon, state, input);
  // Silence or noise: ask again without using up an attempt.
  if (!ctx.text && ctx.choice === null) {
    return { text: ctx.t.web.heardNothing, speech: ctx.t.web.heardNothing, options: null, state: token, locale: ctx.locale };
  }

  try {
    switch (state.step) {
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
    console.error("web voice flow error", { step: state.step, salonId: salon.id, err: err instanceof Error ? err.message : err });
    await logCallOutcome(ctx, state.sid, "error");
    return end(ctx, ctx.t.techError);
  }
}

// ---------------------------------------------------------------------------

function context(db: SalonScope["db"], salon: Salon, state: WebState, input: WebInput): Ctx {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_INPUT);
  const { when, rest } = parseWhen(text);
  if (when) {
    const wanted = resolveWhen(when, new Date(), { timeZone: salon.timezone, opensAt: salon.opens_at, closesAt: salon.closes_at });
    state.w = { t: Math.round(wanted.start.getTime() / 60_000), x: wanted.exact };
  }
  return {
    db,
    salon,
    state,
    locale: state.l,
    t: dictionaryFor(state.l).voice,
    text,
    rest,
    choice: input.choice,
    saidWhen: Boolean(when),
    // Only a day/time was said ("ხვალ ორზე"): note it, don't read it as an option.
    timeOnly: Boolean(when) && !rest && input.choice === null,
  };
}

async function chooseService(ctx: Ctx): Promise<WebTurn> {
  const switchTo = requestedLanguage({ speech: ctx.text }, ctx.locale);
  if (switchTo) {
    ctx.state.l = ctx.locale = switchTo;
    ctx.t = dictionaryFor(switchTo).voice;
    const { error } = await ctx.db.from("clients").update({ locale: switchTo }).eq("id", ctx.state.client).eq("salon_id", ctx.salon.id);
    if (error) console.error("client locale update failed", { salonId: ctx.salon.id, err: error.message });
  }

  const services = await listServices(ctx);
  const options = services.map((s) => describeService(ctx.t, s));
  if (switchTo || ctx.timeOnly) return ask(ctx, `${noted(ctx)}${ctx.t.whichService}`, options);

  const choice = await resolveChoice(ctx, ctx.t.whichService, options, services.map((s) => s.name));
  if (choice.kind !== "choice") return retry(ctx, ctx.t.whichService, options, choice);

  const service = services[choice.index];
  ctx.state.s = service.id;
  resetAttempts(ctx);
  const barbers = await listBarbers(ctx);
  const chosen = ctx.choice === null ? matchLabel(ctx.rest, barbers.map((b) => b.full_name)) : null;
  const lead = fmt(ctx.t.serviceChosen, { service: service.name });
  if (chosen !== null) {
    ctx.state.b = barbers[chosen].id;
    return offer(ctx, service, [barbers[chosen]], barbers, lead);
  }
  ctx.state.step = "barber";
  return ask(ctx, `${lead} ${ctx.t.preferredBarber}`, [...barbers.map((b) => b.full_name), ctx.t.anyBarber]);
}

async function chooseBarber(ctx: Ctx): Promise<WebTurn> {
  const service = await getService(ctx, ctx.state.s);
  if (!service) return restart(ctx);
  const barbers = await listBarbers(ctx);
  const options = [...barbers.map((b) => b.full_name), ctx.t.anyBarber];
  if (ctx.timeOnly) return ask(ctx, `${noted(ctx)}${ctx.t.preferredBarber}`, options);

  const choice = await resolveChoice(ctx, ctx.t.preferredBarber, options);
  if (choice.kind !== "choice") return retry(ctx, ctx.t.preferredBarber, options, choice);

  const one = choice.index < barbers.length ? barbers[choice.index] : null;
  ctx.state.b = one?.id ?? "any";
  resetAttempts(ctx);
  return offer(ctx, service, one ? [one] : barbers, barbers);
}

async function chooseSlot(ctx: Ctx): Promise<WebTurn> {
  const { state, salon } = ctx;
  const [service, client, barbers] = await Promise.all([getService(ctx, state.s), getClient(ctx, state.client), listBarbers(ctx)]);
  if (!service || !client) return restart(ctx);
  const chosenBarbers = state.b && state.b !== "any" ? barbers.filter((b) => b.id === state.b) : barbers;

  // A new day or time: search again from there.
  if (ctx.saidWhen && ctx.choice === null) return offer(ctx, service, chosenBarbers, barbers);

  const offers = (state.o ?? []).map(([staffId, mins]) => ({ staffId, start: new Date(mins * 60_000) }));
  const labels = slotLabels(ctx, offers, barbers);

  let index: number | null = null;
  const yes = ctx.choice === null ? isAffirmative({ speech: ctx.text }) : null;
  if (yes === true && (state.ex || offers.length === 1)) index = 0;
  else if (yes === false) return ask(ctx, ctx.t.web.pickAnother, labels);
  else {
    const choice = await resolveChoice(ctx, ctx.t.nextSlots, labels, offers.map((_, i) => `option ${i + 1}`));
    if (choice.kind !== "choice" || !offers[choice.index]) return retry(ctx, ctx.t.nextSlots, labels, choice);
    index = choice.index;
  }

  const slot = offers[index];
  const barber = barbers.find((b) => b.id === slot.staffId);
  if (!barber) return restart(ctx);

  const booked = await bookAppointment(ctx, { clientId: client.id, staffId: barber.id, serviceId: service.id, start: slot.start });
  if (!booked.ok) return offer(ctx, service, chosenBarbers, barbers, ctx.t.slotTaken);

  await logCallOutcome(ctx, state.sid, "booked", booked.id);
  const when = spokenDate(salon, ctx.locale, slot.start);
  const details = { salon: salon.name, service: service.name, barber: barber.full_name, when };
  const texted = await sendSms(salon, client.phone_number, fmt(dictionaryFor(ctx.locale).sms.booked, details));
  const said = fmt(texted ? ctx.t.booked : ctx.t.web.booked, details);
  const booking: WebBooking = { id: booked.id, service: service.name, barber: barber.full_name, when, start: slot.start.toISOString() };

  if (!client.first_name) {
    state.step = "name";
    state.o = undefined;
    resetAttempts(ctx);
    return { ...ask(ctx, `${said} ${ctx.t.askName}`, []), booking };
  }
  return end(ctx, `${said} ${ctx.t.web.bye}`, booking);
}

async function saveName(ctx: Ctx): Promise<WebTurn> {
  const name = extractFirstName(ctx.text);
  if (name) {
    const { error } = await ctx.db.from("clients").update({ first_name: name }).eq("id", ctx.state.client).eq("salon_id", ctx.salon.id);
    if (error) console.error("client name update failed", { salonId: ctx.salon.id, err: error.message });
  }
  return end(ctx, name ? fmt(ctx.t.web.thanksName, { name }) : ctx.t.web.bye);
}

// ---------------------------------------------------------------------------

/** Offers the open slots nearest the requested time (or the earliest ones). */
async function offer(ctx: Ctx, service: Tables<"services">, chosen: { id: string }[], barbers: { id: string; full_name: string }[], lead = ""): Promise<WebTurn> {
  const { state } = ctx;
  const wanted = state.w ? new Date(state.w.t * 60_000) : undefined;
  let offers = await nextSlots(ctx, service, chosen, 3, wanted);
  // Nothing from that time on within two weeks: fall back to the earliest.
  if (!offers.length && wanted) offers = await nextSlots(ctx, service, chosen, 3);
  const prefix = lead ? `${lead} ` : "";

  if (!offers.length) {
    await logCallOutcome(ctx, state.sid, "no_availability");
    return end(ctx, `${prefix}${ctx.t.web.noAvailability}`);
  }

  const exact = Boolean(wanted && state.w?.x && offers[0].start.getTime() === wanted.getTime());
  state.o = offers.map((o) => [o.staffId, Math.round(o.start.getTime() / 60_000)]);
  state.ex = exact;
  state.step = "slot";

  let intro = ctx.t.nextSlots;
  if (wanted && exact) intro = `${fmt(ctx.t.web.requestedFree, { when: spokenDate(ctx.salon, ctx.locale, wanted) })} ${ctx.t.web.confirmFirst}`;
  else if (wanted && state.w?.x) intro = fmt(ctx.t.web.requestedTaken, { when: spokenDate(ctx.salon, ctx.locale, wanted) });
  return ask(ctx, `${prefix}${intro}`, slotLabels(ctx, offers, barbers));
}

function slotLabels(ctx: Ctx, offers: { staffId: string; start: Date }[], barbers: { id: string; full_name: string }[]) {
  const names = new Map(barbers.map((b) => [b.id, b.full_name]));
  return offers.map((o) => fmt(ctx.t.slotOption, { when: spokenDate(ctx.salon, ctx.locale, o.start), barber: names.get(o.staffId) ?? "" }));
}

/** "Got it, tomorrow." when this turn named a day or time; else "". */
function noted(ctx: Ctx): string {
  if (!ctx.timeOnly || !ctx.state.w) return "";
  const at = new Date(ctx.state.w.t * 60_000);
  const when = ctx.state.w.x
    ? spokenDate(ctx.salon, ctx.locale, at)
    : formatInZone(at, ctx.salon.timezone, { weekday: "long", day: "numeric", month: "long", dateStyle: undefined, timeStyle: undefined }, INTL_LOCALE[ctx.locale]);
  return `${fmt(ctx.t.web.timeNoted, { when })} `;
}

function ask(ctx: Ctx, prompt: string, options: string[], hint = ""): WebTurn {
  const items = options.map((label, i) => fmt(ctx.t.web.menuItem, { n: i + 1, label }));
  const text = hint ? `${prompt} ${hint}` : prompt;
  return {
    text,
    speech: [prompt, ...items, hint].filter(Boolean).join(" "),
    options,
    state: encodeState(ctx.state, secret()),
    locale: ctx.locale,
  };
}

function end(ctx: Ctx, text: string, booking?: WebBooking): WebTurn {
  return { text, speech: text, options: [], state: null, locale: ctx.locale, booking };
}

function resetAttempts(ctx: Ctx) {
  ctx.state.a = 0;
  ctx.state.q = 0;
}

/** Asks again. An answered question leads and uses no attempt. */
async function retry(ctx: Ctx, prompt: string, options: string[], heard: Understanding): Promise<WebTurn> {
  const answered = heard.kind === "question" ? heard.answer : null;
  if (answered) ctx.state.q += 1;
  else ctx.state.a += 1;
  if (ctx.state.a >= MAX_ATTEMPTS) {
    await logCallOutcome(ctx, ctx.state.sid, "abandoned");
    return end(ctx, ctx.t.web.giveUp);
  }
  return ask(ctx, `${answered ?? ctx.t.notUnderstood} ${prompt}`, options);
}

async function restart(ctx: Ctx): Promise<WebTurn> {
  Object.assign(ctx.state, { step: "service", s: undefined, b: undefined, o: undefined, ex: undefined, a: 0, q: 0 });
  const services = await listServices(ctx);
  return ask(ctx, `${ctx.t.restart} ${ctx.t.whichService}`, services.map((s) => describeService(ctx.t, s)));
}

/** Button or keyword match first; the LLM only for speech that didn't match. */
async function resolveChoice(ctx: Ctx, menuPrompt: string, options: string[], matchLabels = options): Promise<Understanding> {
  const index = matchChoice({ digits: ctx.choice === null ? null : String(ctx.choice), speech: ctx.rest }, matchLabels);
  if (index !== null) return { kind: "choice", index };
  if (!ctx.text) return { kind: "unclear" };

  const [services, barbers] = await Promise.all([listServices(ctx), listBarbers(ctx)]);
  const heard = await understand({ facts: { salon: ctx.salon, services, barbers }, locale: ctx.locale, menuPrompt, options, speech: ctx.text });
  if (heard.kind === "question" && ctx.state.q >= MAX_QUESTIONS) return { kind: "unclear" };
  return heard;
}
