"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, parseIn, signupSchema, toFormState, type FormState } from "@/lib/validation";

/** Only same-site relative paths, to prevent open redirects. */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/dashboard") && !v.startsWith("//") ? v : "/dashboard";
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
