"use client";

import Link from "next/link";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { login } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={login} resetOnSuccess={false} className="mt-6 space-y-4" aria-label={t.login.form}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t.login.email} name="email" type="email" autoComplete="email" required />
      <Field label={t.login.password} name="password" type="password" autoComplete="current-password" required />
      <PendingButton pendingLabel={t.login.submitting} className="btn-primary w-full">
        {t.login.submit}
      </PendingButton>
      <p className="text-center text-sm text-muted">
        {t.login.newHere}{" "}
        <Link href="/signup" className="font-medium text-accent underline underline-offset-2">
          {t.login.signup}
        </Link>
      </p>
    </ActionForm>
  );
}
