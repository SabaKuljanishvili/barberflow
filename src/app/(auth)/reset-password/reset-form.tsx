"use client";

import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { PasswordField } from "@/components/ui/password-field";
import { useI18n } from "@/i18n/client";
import { resetPassword } from "../actions";

export function ResetForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={resetPassword} resetOnSuccess={false} className="mt-6 space-y-4" aria-label={t.reset.form}>
      <PasswordField label={t.reset.password} name="password" autoComplete="new-password" required minLength={10} maxLength={72} hint={t.reset.passwordHint} />
      <PasswordField label={t.reset.confirm} name="confirm" autoComplete="new-password" required minLength={10} maxLength={72} />
      <PendingButton pendingLabel={t.reset.submitting} className="btn-primary w-full">
        {t.reset.submit}
      </PendingButton>
    </ActionForm>
  );
}
