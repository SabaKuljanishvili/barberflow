import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { spokenAmount } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

// Fallback for caller speech the keyword matcher in match.ts can't place.
// The call flow stays a state machine: Claude only maps free speech onto the
// menu the caller just heard, or answers a short question from the salon's
// own data. It never books, invents times, or moves the call forward itself.
// Any failure (no key, timeout, refusal, bad output) reads as "unclear", so
// the call falls back to the normal retry.

const MODEL = "claude-opus-5-5";
const GROQ_MODEL = "openai/gpt-oss-120b";
// Twilio gives a webhook 15 s, and Azure TTS still has to run after this.
const TIMEOUT_MS = 4_000;
const MAX_ANSWER = 300;
// Smaller models sometimes slip other scripts into Georgian (seen: Devanagari).
// TTS can't read that, so such an answer counts as "unclear".
const FOREIGN_SCRIPT = /[^\p{Script=Georgian}\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

export type Understanding = { kind: "choice"; index: number } | { kind: "question"; answer: string } | { kind: "unclear" };

export type SalonFacts = {
  salon: Pick<Tables<"salons">, "name" | "opens_at" | "closes_at" | "working_days">;
  services: Pick<Tables<"services">, "name" | "price" | "duration_minutes">[];
  barbers: { full_name: string }[];
};

const Result = z.object({
  kind: z.enum(["choice", "question", "unclear"]),
  option: z.number().int().nullable(),
  answer: z.string().nullable(),
});

const SYSTEM = `You are the phone receptionist for a barber shop that uses BarberFlow. A caller is in an automated booking call. They just heard a numbered menu and answered by voice. Speech recognition on phone lines is noisy, especially for Georgian, so the transcript may be misspelled, partial, or mix Georgian and English.

Decide which of these the caller did:
- "choice": they picked one menu option, by number, ordinal, name, or description ("the beard one", "Tuesday", "მეორე", "ნებისმიერი"). Set option to its 1-based number.
- "question": they asked something about the salon instead of choosing (prices, hours, how long a service takes, which barbers work there). Set answer to the reply.
- "unclear": anything else, including silence, noise, or a choice you can't place with confidence.

Prefer "unclear" over guessing a choice: a wrong pick books the wrong appointment, while "unclear" only repeats the menu.

When you answer a question:
- Use only the salon facts given below. If they don't cover it, say you don't have that information and that the salon staff can help.
- Never offer or confirm appointment times, and never say a booking is made. The menu handles that.
- Write in the call's language, as natural spoken sentences for text-to-speech: one or two short sentences, no lists, symbols, or markdown. Say prices as "25 lari" / "25 ლარი".
- In Georgian, use a warm, polite receptionist register (თქვენობით). End by inviting them to choose from the menu.
- If the question has nothing to do with the salon, politely say you can only help with bookings and salon questions.

Leave unused fields null.`;

const WEEKDAY_NAMES: Record<Locale, string[]> = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  ka: ["ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი", "კვირა"],
};

/** The per-call part of the prompt: salon data, the menu and what was said. */
export function describeTurn(facts: SalonFacts, locale: Locale, menuPrompt: string, options: string[], speech: string): string {
  const days = facts.salon.working_days
    .filter((d) => d >= 1 && d <= 7)
    .map((d) => WEEKDAY_NAMES[locale][d - 1])
    .join(", ");
  const services = facts.services.map((s) => `- ${s.name}: ${spokenAmount(s.price)} lari, ${s.duration_minutes} minutes`).join("\n");
  const barbers = facts.barbers.map((b) => `- ${b.full_name}`).join("\n");
  const menu = options.map((label, i) => `${i + 1}. ${label}`).join("\n");
  return [
    `Call language: ${INTL_LOCALE[locale]}`,
    `<salon>\nName: ${facts.salon.name}\nOpen: ${days}, ${facts.salon.opens_at.slice(0, 5)}-${facts.salon.closes_at.slice(0, 5)}\nServices:\n${services || "- none"}\nBarbers:\n${barbers || "- none"}\n</salon>`,
    `<menu>\nThe caller heard: ${menuPrompt}\n${menu}\n</menu>`,
    `<caller_said>${speech}</caller_said>`,
  ].join("\n\n");
}

/** Turns the model's output into a safe result: options in range, answers present and short. */
export function toUnderstanding(raw: z.infer<typeof Result> | null, optionCount: number): Understanding {
  if (!raw) return { kind: "unclear" };
  if (raw.kind === "choice" && raw.option !== null && raw.option >= 1 && raw.option <= optionCount) {
    return { kind: "choice", index: raw.option - 1 };
  }
  const answer = raw.answer?.replace(/\s+/g, " ").trim();
  if (raw.kind === "question" && answer && !FOREIGN_SCRIPT.test(answer)) {
    return { kind: "question", answer: answer.length > MAX_ANSWER ? `${answer.slice(0, answer.lastIndexOf(" ", MAX_ANSWER))}…` : answer };
  }
  return { kind: "unclear" };
}

let client: Anthropic | null = null;

async function askClaude(turn: string): Promise<z.infer<typeof Result> | null> {
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Result) },
    system: SYSTEM,
    messages: [{ role: "user", content: turn }],
  });
  if (response.stop_reason !== "end_turn") {
    console.warn("voice understand: no usable answer", { stop: response.stop_reason });
    return null;
  }
  return response.parsed_output;
}

// Groq's OpenAI-compatible API, used only when no Anthropic key is set
// (testing, or as a cheap alternative). Same prompt, same strict schema.
async function askGroq(turn: string): Promise<z.infer<typeof Result> | null> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_completion_tokens: 2048,
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: z.toJSONSchema(Result) } },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: turn },
      ],
    }),
  });
  if (!response.ok) throw new Error(`groq ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = data.choices?.[0];
  if (choice?.finish_reason !== "stop" || !choice.message?.content) {
    console.warn("voice understand: no usable answer", { stop: choice?.finish_reason });
    return null;
  }
  const parsed = Result.safeParse(JSON.parse(choice.message.content));
  return parsed.success ? parsed.data : null;
}

export async function understand(input: {
  facts: SalonFacts;
  locale: Locale;
  menuPrompt: string;
  options: string[];
  speech: string;
}): Promise<Understanding> {
  const speech = input.speech.trim();
  const ask = process.env.ANTHROPIC_API_KEY ? askClaude : process.env.GROQ_API_KEY ? askGroq : null;
  if (!speech || !input.options.length || !ask) return { kind: "unclear" };

  try {
    const raw = await ask(describeTurn(input.facts, input.locale, input.menuPrompt, input.options, speech));
    return toUnderstanding(raw, input.options.length);
  } catch (err) {
    console.error("voice understand failed", { err: err instanceof Error ? err.message : err });
    return { kind: "unclear" };
  }
}
