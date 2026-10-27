import "server-only";
import twilio from "twilio";
import { serverEnv } from "@/lib/env.server";

export type TwilioParams = Record<string, string>;

/**
 * Reads the form body and verifies X-Twilio-Signature against the public URL
 * Twilio called (which includes our signed query-string state). Returns null
 * when the request did not come from Twilio.
 */
export async function verifyTwilioRequest(request: Request): Promise<{ params: TwilioParams; url: URL } | null> {
  const env = serverEnv();
  const incoming = new URL(request.url);
  const publicUrl = new URL(incoming.pathname + incoming.search, env.TWILIO_WEBHOOK_BASE_URL);

  const form = await request.formData();
  const params: TwilioParams = {};
  for (const [k, v] of form) if (typeof v === "string") params[k] = v;

  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!signature || !twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, publicUrl.toString(), params)) {
    // The usual cause for real Twilio traffic is TWILIO_WEBHOOK_BASE_URL not
    // matching the URL configured in the Twilio console (scheme, host, port).
    console.warn("twilio signature rejected", {
      path: incoming.pathname,
      expectedUrl: publicUrl.origin + publicUrl.pathname,
      hasSignature: Boolean(signature),
      callSid: params.CallSid ?? params.MessageSid,
    });
    return null;
  }
  return { params, url: publicUrl };
}

export function twilioClient() {
  const env = serverEnv();
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export function webhookUrl(path: string, query: Record<string, string | number | undefined> = {}): string {
  const url = new URL(path, serverEnv().TWILIO_WEBHOOK_BASE_URL);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  return url.toString();
}

export function twiml(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Spoken apology for failures outside the call flow (bad config, DB down). */
export function twimlError(): Response {
  const r = new twilio.twiml.VoiceResponse();
  r.say({ voice: "Polly.Joanna", language: "en-US" }, "Sorry, we can't take your call right now. Please try again in a few minutes.");
  r.hangup();
  return twiml(r.toString());
}

export const VoiceResponse = twilio.twiml.VoiceResponse;
export const MessagingResponse = twilio.twiml.MessagingResponse;
