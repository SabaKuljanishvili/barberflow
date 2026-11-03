import "server-only";
import twilio from "twilio";
import { siteUrl } from "@/lib/env";
import { twilioConfig } from "./twilio";
import { expectedWebhooks, webhookChecks, type Webhooks } from "./twilio-status";

export type NumberLookup =
  | { kind: "not-configured" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "found"; sid: string; voiceUrl: string; smsUrl: string; statusCallback: string };

/** Base the webhooks must use: Twilio signs requests against TWILIO_WEBHOOK_BASE_URL. */
export function webhookBase(): string {
  return twilioConfig()?.baseUrl ?? siteUrl();
}

export function webhookUrls(): Webhooks {
  return expectedWebhooks(webhookBase());
}

/** Looks the number up in the configured Twilio account. Never throws. */
export async function lookupTwilioNumber(e164: string): Promise<NumberLookup> {
  const config = twilioConfig();
  if (!config) return { kind: "not-configured" };
  try {
    const client = twilio(config.accountSid, config.authToken, { timeout: 6_000 });
    const [n] = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
    if (!n) return { kind: "missing" };
    return { kind: "found", sid: n.sid, voiceUrl: n.voiceUrl, smsUrl: n.smsUrl, statusCallback: n.statusCallback };
  } catch (e) {
    console.error("twilio number lookup failed", (e as { status?: number }).status ?? "network");
    return { kind: "error" };
  }
}

export type ConnectionStatus =
  | { kind: "no-number" }
  | { kind: "not-configured" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "checked"; voice: boolean; sms: boolean; status: boolean };

export async function connectionStatus(phone: string | null): Promise<ConnectionStatus> {
  if (!phone) return { kind: "no-number" };
  const found = await lookupTwilioNumber(phone);
  if (found.kind !== "found") return found;
  return { kind: "checked", ...webhookChecks(found, webhookBase()) };
}
