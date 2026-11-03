import "server-only";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { azureConfig } from "./tts";

// Speech-to-text for the web voice agent: Azure's REST API for short audio
// (up to 60 s), same Speech resource and key as TTS. The browser records
// 16 kHz mono 16-bit PCM WAV (lib/voice/web-audio.ts), which this API takes
// as is. Georgian (ka-GE) is supported.

/** 30 s of 16 kHz 16-bit mono is 960 KB; anything larger is not ours. */
export const MAX_AUDIO_BYTES = 1_000_000;

export function sttConfigured(): boolean {
  return azureConfig() !== null;
}

/** True for a RIFF/WAVE header. Cheap guard before paying for recognition. */
export function isWav(bytes: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  return bytes.length > 44 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
}

/** Recognized text, or "" when nothing was said. Throws on service errors. */
export async function transcribe(wav: ArrayBuffer, locale: Locale): Promise<string> {
  const azure = azureConfig();
  if (!azure) throw new Error("Azure Speech is not configured");
  const url = new URL(`https://${azure.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
  url.searchParams.set("language", INTL_LOCALE[locale]);
  url.searchParams.set("format", "simple");
  url.searchParams.set("profanity", "raw");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azure.key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
    },
    body: wav,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`azure stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { RecognitionStatus?: string; DisplayText?: string };
  return data.RecognitionStatus === "Success" ? (data.DisplayText ?? "").trim() : "";
}
