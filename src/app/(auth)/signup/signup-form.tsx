"use client";

import Link from "next/link";
import { ActionForm, PendingButton, useFieldErrors } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { useI18n } from "@/i18n/client";
import { signup } from "../actions";

function TermsCheckbox() {
  const { t } = useI18n();
  const errors = useFieldErrors("acceptTerms");
  return (
    <div>
      <div className="flex items-start gap-3">
        {/* aria-labelledby covers the whole sentence, links included, so the
            accessible name is "I agree to the Terms ... Privacy Policy". */}
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          className="mt-1 size-4 rounded accent-brand"
          aria-labelledby="acceptTerms-label"
          aria-invalid={errors ? true : undefined}
          aria-describedby={errors ? "acceptTerms-error" : undefined}
        />
        <p id="acceptTerms-label" className="text-sm text-muted">
          <label htmlFor="acceptTerms">{t.signup.agree}</label>{" "}
          <Link href="/legal/terms" className="font-medium text-accent underline underline-offset-2">
            {t.signup.terms}
          </Link>{" "}
          <label htmlFor="acceptTerms">{t.signup.andRead}</label>{" "}
          <Link href="/legal/privacy" className="font-medium text-accent underline underline-offset-2">
            {t.signup.privacy}
          </Link>
          .
        </p>
      </div>
      {errors && (
        <p id="acceptTerms-error" className="field-error">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

export function SignupForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={signup} className="mt-6 space-y-4" aria-label={t.signup.form}>
      <Field label={t.signup.fullName} name="fullName" autoComplete="name" required maxLength={120} />
      <Field label={t.signup.shopName} name="salonName" autoComplete="organization" required maxLength={120} />
      <Field label={t.signup.email} name="email" type="email" autoComplete="email" required />
      <PasswordField label={t.signup.password} name="password" autoComplete="new-password" required minLength={10} maxLength={72} hint={t.signup.passwordHint} />
      <TermsCheckbox />
      <PendingButton pendingLabel={t.signup.submitting} className="btn-primary w-full">
        {t.signup.submit}
      </PendingButton>
      <p className="text-center text-sm text-muted">
        {t.signup.haveAccount}{" "}
        <Link href="/login" className="font-medium text-accent underline underline-offset-2">
          {t.signup.signIn}
        </Link>
      </p>
    </ActionForm>
  );
}
