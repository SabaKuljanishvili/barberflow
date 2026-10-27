import { decodeText, MAX_CHUNK, verifySpeech } from "@/lib/voice/speech";
import { AUDIO_CONTENT_TYPE, azureConfig, speechSecret, synthesize } from "@/lib/voice/tts";

export const dynamic = "force-dynamic";

// Audio for one <Play>. Twilio fetches it with GET; the URL carries the text
// and an HMAC over it, so only text our own TwiML asked for is synthesized.
// Responses are immutable for a given URL, so the CDN and Twilio cache them.

const cache = new Map<string, ArrayBuffer>();
const CACHE_ENTRIES = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voice = url.searchParams.get("v") ?? "";
  const encoded = url.searchParams.get("t") ?? "";
  const signature = url.searchParams.get("s") ?? "";

  const azure = azureConfig();
  if (!azure) return new Response("TTS not configured", { status: 503 });
  if (!Object.values(azure.voices).includes(voice) || !verifySpeech(speechSecret(), voice, encoded, signature)) {
    return new Response("Forbidden", { status: 403 });
  }
  const text = decodeText(encoded);
  if (!text || text.length > MAX_CHUNK * 2) return new Response("Bad request", { status: 400 });

  const key = `${voice}\n${encoded}`;
  let audio = cache.get(key);
  if (!audio) {
    try {
      audio = await synthesize(text, voice);
    } catch (err) {
      console.error("tts failed", { voice, chars: text.length, err: err instanceof Error ? err.message : err });
      return new Response("TTS failed", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, audio);
  }

  return new Response(audio, {
    headers: {
      "Content-Type": AUDIO_CONTENT_TYPE,
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
