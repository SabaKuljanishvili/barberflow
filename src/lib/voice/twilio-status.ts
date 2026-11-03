// Pure helpers for the Settings "Twilio connection" panel; the network call
// lives in twilio-numbers.ts.

export type Webhooks = { voice: string; status: string; sms: string };

export function expectedWebhooks(base: string): Webhooks {
  const origin = new URL(base).origin;
  return {
    voice: `${origin}/api/voice/incoming`,
    status: `${origin}/api/voice/status`,
    sms: `${origin}/api/sms/incoming`,
  };
}

function same(actual: string | null | undefined, expected: string): boolean {
  if (!actual) return false;
  try {
    const a = new URL(actual);
    return a.origin + a.pathname.replace(/\/+$/, "") === expected;
  } catch {
    return false;
  }
}

export function webhookChecks(
  number: { voiceUrl?: string | null; smsUrl?: string | null; statusCallback?: string | null },
  base: string,
): Record<keyof Webhooks, boolean> {
  const want = expectedWebhooks(base);
  return { voice: same(number.voiceUrl, want.voice), sms: same(number.smsUrl, want.sms), status: same(number.statusCallback, want.status) };
}
