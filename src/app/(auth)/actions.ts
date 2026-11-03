"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  parseIn,
  passwordChangeSchema,
  signupSchema,
  toFormState,
  type FormState,
} from "@/lib/validation";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getI18n();
  const parsed = parseIn(loginSchema, Object.fromEntries(formData), locale);
  if (!parsed.success) return toFormState(parsed.error, t.validation);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message: never reveal whether the email exists.
  if (error) return { ok: false, message: t.auth.login.failed };

  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getI18n();
  const parsed = parseIn(signupSchema, Object.fromEntries(formData), locale);
  if (!parsed.success) return toFormState(parsed.error, t.validation);
  const { email, password, fullName, salonName } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      // The signup trigger copies locale onto the new salon (agent + SMS language).
      data: { full_name: fullName, salon_name: salonName, locale, terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) {
    console.error("signup failed", error.code);
    return { ok: false, message: t.auth.signup.failed };
  }
  return { ok: true, message: t.auth.signup.checkEmail };
}

/**
 * Sends a recovery email. Always answers with the same message, whether or
 * not the account exists (no account enumeration). Limited per IP and per
 * address on top of the proxy's per-path limit and Supabase's own limit.
 */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getI18n();
  const parsed = parseIn(forgotPasswordSchema, Object.fromEntries(formData), locale);
  if (!parsed.success) return toFormState(parsed.error, t.validation);
  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  const perIp = rateLimit(`reset-ip:${ip}`, 5, 15 * 60_000);
  const perEmail = rateLimit(`reset-email:${email}`, 3, 15 * 60_000);
  if (!perIp.ok || !perEmail.ok) return { ok: false, message: t.auth.forgot.tooMany };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Log the code only; the user still sees the neutral message.
  if (error) console.error("password reset email failed", error.code);
  return { ok: true, message: t.auth.forgot.sent };
}

/** Sets the new password on the recovery (or invite) session, then signs out every other session. */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getI18n();
  const parsed = parseIn(passwordChangeSchema, Object.fromEntries(formData), locale);
  if (!parsed.success) return toFormState(parsed.error, t.validation);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return { ok: false, message: t.auth.reset.expired };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("password reset failed", error.code);
    return { ok: false, message: t.auth.reset.failed };
  }
  await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard");
}
