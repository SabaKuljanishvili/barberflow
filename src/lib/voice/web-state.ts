import { createHmac, timingSafeEqual } from "node:crypto";
import { isLocale, type Locale } from "@/i18n/config";

// The web voice agent keeps its conversation state in the browser, like the
// phone flow keeps it in Twilio's signed callback URLs. The token is
// HMAC-signed, so the browser can carry it but not change it, and it expires.
// Every id in it is still re-checked against the signed-in user's salon.

export type WebStep = "service" | "barber" | "slot" | "name";

export type WebState = {
  /** Salon id; must match the session's salon. */
  salon: string;
  /** call_logs.call_sid of this session ("web-<uuid>"). */
  sid: string;
  client: string;
  l: Locale;
  step: WebStep;
  /** Chosen service id. */
  s?: string;
  /** Chosen barber id, or "any". */
  b?: string;
  /** Requested start (epoch minutes) and whether a time (not just a day) was given. */
  w?: { t: number; x: boolean };
  /** Offered slots: [staff id, epoch minutes]. */
  o?: [string, number][];
  /** The first offer is exactly the requested time, so "yes" picks it. */
  ex?: boolean;
  /** Failed attempts and answered questions on the current step. */
  a: number;
  q: number;
  /** Expiry, epoch ms. */
  exp: number;
};

export const SESSION_MS = 30 * 60_000;

const STEPS: WebStep[] = ["service", "barber", "slot", "name"];

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(`web-voice\n${payload}`).digest("base64url");
}

export function encodeState(state: WebState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

/** The state, or null when the token is forged, malformed or expired. */
export function decodeState(token: string, secret: string, now = Date.now()): WebState | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as WebState;
    if (typeof state !== "object" || !state || typeof state.exp !== "number" || state.exp < now) return null;
    if (!STEPS.includes(state.step) || !isLocale(state.l) || typeof state.salon !== "string" || typeof state.client !== "string") return null;
    return state;
  } catch {
    return null;
  }
}
