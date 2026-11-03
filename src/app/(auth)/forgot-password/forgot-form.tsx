"use client";

import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={requestPasswordReset} className="mt-6 space-y-4" aria-label={t.forgot.form}>
      <Field label={t.forgot.email} name="email" type="email" autoComplete="email" required maxLength={254} />
      <PendingButton pendingLabel={t.forgot.submitting} className="btn-primary w-full">
        {t.forgot.submit}
      </PendingButton>
    </ActionForm>
  );
}
