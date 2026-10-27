import { describe, expect, it } from "vitest";
import { MAX_CHUNK, buildSsml, decodeText, encodeText, signSpeech, splitForSpeech, verifySpeech, voiceLanguage } from "./speech";

describe("splitForSpeech", () => {
  it("keeps short text in one chunk", () => {
    expect(splitForSpeech("მოგესალმებით. რომელი სერვისი გსურთ?")).toEqual(["მოგესალმებით. რომელი სერვისი გსურთ?"]);
  });

  it("splits on sentences and never exceeds the limit", () => {
    const sentence = "პუნქტი 1: თმის შეჭრა, 25 ლარი, 30 წუთი. დააჭირეთ ან თქვით 1. ";
    const chunks = splitForSpeech(sentence.repeat(20));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_CHUNK);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(sentence.repeat(20).trim().replace(/\s+/g, " "));
  });

  it("cuts an over-long sentence at word boundaries", () => {
    const chunks = splitForSpeech("სიტყვა ".repeat(100), 50);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(50);
      expect(c.endsWith("სიტყ")).toBe(false);
    }
  });

  it("returns nothing for blank text", () => {
    expect(splitForSpeech("  ")).toEqual([]);
  });
});

describe("SSML", () => {
  it("escapes text and sets the language from the voice", () => {
    expect(voiceLanguage("ka-GE-EkaNeural")).toBe("ka-GE");
    const ssml = buildSsml(`Tom & Jerry's <fade>`, "en-US-JennyNeural");
    expect(ssml).toContain('xml:lang="en-US"');
    expect(ssml).toContain("Tom &amp; Jerry&apos;s &lt;fade&gt;");
  });
});

describe("TTS URL signing", () => {
  const secret = "test-secret";
  const voice = "ka-GE-EkaNeural";

  it("round-trips Georgian text", () => {
    const text = "კეთილი იყოს თქვენი დაბრუნება, ნინო.";
    expect(decodeText(encodeText(text))).toBe(text);
  });

  it("rejects malformed encodings", () => {
    expect(decodeText("not base64!")).toBeNull();
    expect(decodeText("")).toBeNull();
  });

  it("accepts its own signature only", () => {
    const t = encodeText("გამარჯობა");
    const sig = signSpeech(secret, voice, t);
    expect(verifySpeech(secret, voice, t, sig)).toBe(true);
    expect(verifySpeech(secret, "ka-GE-GiorgiNeural", t, sig)).toBe(false);
    expect(verifySpeech(secret, voice, encodeText("სხვა ტექსტი"), sig)).toBe(false);
    expect(verifySpeech("other", voice, t, sig)).toBe(false);
    expect(verifySpeech(secret, voice, t, "short")).toBe(false);
  });
});
