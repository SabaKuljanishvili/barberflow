import { describe, expect, it, vi } from "vitest";
import { parseAzureEnv, parseTwilioEnv } from "./env-sections";

describe("parseAzureEnv", () => {
  it("returns the config when key and region are valid", () => {
    expect(parseAzureEnv({ AZURE_SPEECH_KEY: "k".repeat(32), AZURE_SPEECH_REGION: "westeurope" })).toEqual({
      key: "k".repeat(32),
      region: "westeurope",
      voices: { ka: "ka-GE-EkaNeural", en: "en-US-JennyNeural" },
    });
  });

  it("returns null when not configured", () => {
    expect(parseAzureEnv({})).toBeNull();
    expect(parseAzureEnv({ AZURE_SPEECH_KEY: "", AZURE_SPEECH_REGION: "" })).toBeNull();
  });

  it("ignores unrelated invalid variables (they used to crash /dashboard/voice)", () => {
    const env = { AZURE_SPEECH_KEY: "k".repeat(32), AZURE_SPEECH_REGION: "westeurope", CRON_SECRET: "short", TWILIO_ACCOUNT_SID: "nope" };
    expect(parseAzureEnv(env)?.region).toBe("westeurope");
  });

  it("normalizes a region typed with capitals or spaces, and logs (not throws) a bad one", () => {
    expect(parseAzureEnv({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: " West Europe " })?.region).toBe("westeurope");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseAzureEnv({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "west-europe!" })).toBeNull();
    expect(parseAzureEnv({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "westeurope", AZURE_TTS_VOICE_KA: "Eka" })).toBeNull();
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0])).not.toContain("west-europe!");
    spy.mockRestore();
  });
});

describe("parseTwilioEnv", () => {
  const sid = `AC${"a".repeat(32)}`;

  it("returns null unless all three are set", () => {
    expect(parseTwilioEnv({})).toBeNull();
    expect(parseTwilioEnv({ TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: "t".repeat(32) })).toBeNull();
  });

  it("strips any path from the webhook base URL", () => {
    const env = { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: "t".repeat(32), TWILIO_WEBHOOK_BASE_URL: "https://x.vercel.app/login/" };
    expect(parseTwilioEnv(env)).toEqual({ accountSid: sid, authToken: "t".repeat(32), baseUrl: "https://x.vercel.app" });
  });

  it("returns null and logs for a malformed SID instead of throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseTwilioEnv({ TWILIO_ACCOUNT_SID: "bad", TWILIO_AUTH_TOKEN: "t".repeat(32), TWILIO_WEBHOOK_BASE_URL: "https://x.app" })).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
