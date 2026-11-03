"use server";

import { headers } from "next/headers";
import { getI18n } from "@/i18n/server";
import { buildContactEmail, contactSchema } from "@/lib/contact";
import { rateLimit } from "@/lib/rate-limit";
import { parseIn, toFormState, type FormState } from "@/lib/validation";

function mailConfig() {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  return key && to && from ? { key, to, from } : null;
}

/** Contact form: honeypot, per-IP limit, then one email via the Resend API. */
export async function sendContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getI18n();
  const parsed = parseIn(contactSchema, Object.fromEntries(formData), locale);
  if (!parsed.success) return toFormState(parsed.error, t.validation);
  // Bots get the normal success message and nothing is sent.
  if (parsed.data.bot) return { ok: true, message: t.contact.form.sent };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
  if (!rateLimit(`contact:${ip}`, 3, 10 * 60_000).ok) return { ok: false, message: t.contact.form.tooMany };

  const config = mailConfig();
  if (!config) {
    console.error("contact form: RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL not set");
    return { ok: false, message: t.contact.form.unavailable };
  }
  const mail = buildContactEmail(parsed.data);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [config.to], ...mail }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  } catch (e) {
    console.error("contact form send failed", (e as Error).message);
    return { ok: false, message: t.contact.form.failed };
  }
  return { ok: true, message: t.contact.form.sent };
}
