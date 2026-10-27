import "server-only";
import type { Locale } from "@/i18n/config";
import { serverEnv } from "@/lib/env.server";
import { buildSsml, encodeText, signSpeech, splitForSpeech } from "./speech";
import { webhookUrl } from "./twilio";

// Twilio's <Say> has no Georgian voice, so the agent speaks through Azure
// neural TTS: each sentence becomes a signed /api/voice/tts URL that Twilio
// fetches with <Play>. English falls back to Twilio's own voice when Azure is
// not configured; Georgian cannot, so calls switch to English instead.

/** Anything TwiML that can contain <Say> and <Play> (VoiceResponse, Gather). */
type Speaker = {
  say(attributes: object, message: string): unknown;
  play(attributes: object, url: string): unknown;
};

const SAY_FALLBACK = { voice: "Polly.Joanna-Neural", language: "en-US" };

/** Wav at the phone network's sample rate: no resampling on Twilio's side. */
export const AUDIO_FORMAT = "riff-8khz-16bit-mono-pcm";
export const AUDIO_CONTENT_TYPE = "audio/wav";

export function azureConfig() {
  const env = serverEnv();
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) return null;
  return {
    key: env.AZURE_SPEECH_KEY,
    region: env.AZURE_SPEECH_REGION,
    voices: { ka: env.AZURE_TTS_VOICE_KA, en: env.AZURE_TTS_VOICE_EN } satisfies Record<Locale, string>,
  };
}

let warned = false;

/** The locale a call can actually be spoken in. */
export function speakableLocale(wanted: Locale): Locale {
  if (wanted === "en" || azureConfig()) return wanted;
  if (!warned) {
    console.error("AZURE_SPEECH_KEY/AZURE_SPEECH_REGION not set: Georgian calls fall back to English");
    warned = true;
  }
  return "en";
}

/** Signing key for TTS URLs, derived so no extra secret is needed. */
export function speechSecret(): string {
  return `tts:${serverEnv().TWILIO_AUTH_TOKEN}`;
}

export function speak(node: Speaker, text: string, locale: Locale): void {
  const azure = azureConfig();
  if (!azure) {
    node.say(SAY_FALLBACK, text);
    return;
  }
  const voice = azure.voices[locale];
  for (const chunk of splitForSpeech(text)) {
    const t = encodeText(chunk);
    node.play({}, webhookUrl("/api/voice/tts", { v: voice, t, s: signSpeech(speechSecret(), voice, t) }));
  }
}

/** Calls Azure's REST endpoint. Throws on any non-audio answer. */
export async function synthesize(text: string, voice: string): Promise<ArrayBuffer> {
  const azure = azureConfig();
  if (!azure) throw new Error("Azure Speech is not configured");
  const res = await fetch(`https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azure.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": AUDIO_FORMAT,
      "User-Agent": "barberflow",
    },
    body: buildSsml(text, voice),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`azure tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}
