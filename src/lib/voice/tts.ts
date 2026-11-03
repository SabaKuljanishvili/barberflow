import "server-only";
import type { Locale } from "@/i18n/config";
import { parseAzureEnv, type AzureEnv } from "@/lib/env-sections";
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
/** Browser playback (web voice agent): small, and decodable by every AudioContext. */
export const WEB_AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Azure Speech credentials, or null when not (validly) configured. Never throws. */
export function azureConfig(): (AzureEnv & { voices: Record<Locale, string> }) | null {
  return parseAzureEnv(process.env);
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
  return `tts:${process.env.TWILIO_AUTH_TOKEN?.trim() || serverEnv().SUPABASE_SERVICE_ROLE_KEY}`;
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
export async function synthesize(text: string, voice: string, format = AUDIO_FORMAT): Promise<ArrayBuffer> {
  const azure = azureConfig();
  if (!azure) throw new Error("Azure Speech is not configured");
  const res = await fetch(`https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azure.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": format,
      "User-Agent": "barberflow",
    },
    body: buildSsml(text, voice),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`azure tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}
