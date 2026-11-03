import { describe, expect, it } from "vitest";
import { expectedWebhooks, webhookChecks } from "./twilio-status";

const base = "https://devsk.ge";

describe("expectedWebhooks", () => {
  it("builds absolute URLs from the base origin", () => {
    expect(expectedWebhooks("https://devsk.ge/")).toEqual({
      voice: "https://devsk.ge/api/voice/incoming",
      status: "https://devsk.ge/api/voice/status",
      sms: "https://devsk.ge/api/sms/incoming",
    });
  });
});

describe("webhookChecks", () => {
  const good = { voiceUrl: `${base}/api/voice/incoming`, smsUrl: `${base}/api/sms/incoming`, statusCallback: `${base}/api/voice/status` };

  it("passes when every webhook points at us", () => {
    expect(webhookChecks(good, base)).toEqual({ voice: true, sms: true, status: true });
  });

  it("ignores a trailing slash or query string but not another host or path", () => {
    expect(webhookChecks({ ...good, voiceUrl: `${base}/api/voice/incoming/?x=1` }, base).voice).toBe(true);
    expect(webhookChecks({ ...good, voiceUrl: "https://demo.twilio.com/welcome/voice/" }, base).voice).toBe(false);
    expect(webhookChecks({ ...good, smsUrl: "" }, base).sms).toBe(false);
    expect(webhookChecks({ ...good, statusCallback: "http://devsk.ge/api/voice/status" }, base).status).toBe(false);
  });
});
