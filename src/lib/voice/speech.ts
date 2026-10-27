import { createHmac, timingSafeEqual } from "node:crypto";

// Pure helpers behind the TTS endpoint: chunking, SSML and URL signing.

/** Longest text per <Play>. Keeps signed URLs short (Georgian is 3 bytes/char). */
export const MAX_CHUNK = 320;

/**
 * Splits text into sentence-aligned chunks of at most `max` characters, so
 * repeated sentences (greetings, menus) hit the audio cache. A sentence longer
 * than `max` is cut at commas, then spaces.
 */
export function splitForSpeech(text: string, max = MAX_CHUNK): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];

  const pieces = sentences.flatMap((s) => (s.length <= max ? [s] : cut(s, max)));
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 1 + piece.length <= max) chunks[chunks.length - 1] = `${last} ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

function cut(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const at = Math.max(window.lastIndexOf(", "), window.lastIndexOf(" "));
    const end = at > max / 3 ? at + 1 : max;
    out.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

/** "ka-GE-EkaNeural" -> "ka-GE". */
export function voiceLanguage(voice: string): string {
  return voice.split("-").slice(0, 2).join("-");
}

export function buildSsml(text: string, voice: string): string {
  const lang = voiceLanguage(voice);
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`
  );
}

export function encodeText(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

export function decodeText(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  const text = Buffer.from(encoded, "base64url").toString("utf8");
  // Round-trip check rejects malformed input and invalid UTF-8.
  return encodeText(text) === encoded ? text : null;
}

export function signSpeech(secret: string, voice: string, encoded: string): string {
  return createHmac("sha256", secret).update(`tts\n${voice}\n${encoded}`).digest("base64url").slice(0, 32);
}

export function verifySpeech(secret: string, voice: string, encoded: string, signature: string): boolean {
  const expected = Buffer.from(signSpeech(secret, voice, encoded));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
