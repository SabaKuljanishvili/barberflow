import { z } from "zod";

// Optional integrations (Azure Speech, Twilio) are parsed on their own, so one
// malformed variable only switches off its own feature. Parsing the whole
// server env at render time used to crash /dashboard/voice when any unrelated
// key (CRON_SECRET, TWILIO_*) was invalid on the deployment.
// Problems are logged with key names only, never values.

type Env = Record<string, string | undefined>;

const blank = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : undefined;
};

const VOICE_RE = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/;

export type AzureEnv = { key: string; region: string; voices: { ka: string; en: string } };

export function parseAzureEnv(env: Env): AzureEnv | null {
  const key = blank(env.AZURE_SPEECH_KEY);
  // "West Europe" in the portal is "westeurope" in the API.
  const region = blank(env.AZURE_SPEECH_REGION)?.toLowerCase().replace(/\s+/g, "");
  if (!key || !region) return null;
  const ka = blank(env.AZURE_TTS_VOICE_KA) ?? "ka-GE-EkaNeural";
  const en = blank(env.AZURE_TTS_VOICE_EN) ?? "en-US-JennyNeural";
  const bad = [
    !/^[a-z0-9]+$/.test(region) && "AZURE_SPEECH_REGION",
    !VOICE_RE.test(ka) && "AZURE_TTS_VOICE_KA",
    !VOICE_RE.test(en) && "AZURE_TTS_VOICE_EN",
  ].filter(Boolean);
  if (bad.length) {
    console.error(`Azure Speech disabled, invalid env: ${bad.join(", ")}`);
    return null;
  }
  return { key, region, voices: { ka, en } };
}

export type TwilioEnv = { accountSid: string; authToken: string; baseUrl: string };

export function parseTwilioEnv(env: Env): TwilioEnv | null {
  const accountSid = blank(env.TWILIO_ACCOUNT_SID);
  const authToken = blank(env.TWILIO_AUTH_TOKEN);
  const base = blank(env.TWILIO_WEBHOOK_BASE_URL);
  if (!accountSid || !authToken || !base) return null;
  const origin = z.url().safeParse(base).success ? new URL(base).origin : null;
  const bad = [
    !/^AC[0-9a-f]{32}$/i.test(accountSid) && "TWILIO_ACCOUNT_SID",
    authToken.length < 16 && "TWILIO_AUTH_TOKEN",
    !origin && "TWILIO_WEBHOOK_BASE_URL",
  ].filter(Boolean);
  if (bad.length || !origin) {
    console.error(`Twilio disabled, invalid env: ${bad.join(", ")}`);
    return null;
  }
  return { accountSid, authToken, baseUrl: origin };
}
