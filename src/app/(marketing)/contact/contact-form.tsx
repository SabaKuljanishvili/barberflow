"use client";

import { ActionForm, PendingButton, useFieldErrors } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { sendContactMessage } from "./actions";

function Message({ label }: { label: string }) {
  const errors = useFieldErrors("message");
  return (
    <div>
      <label htmlFor="message" className="label">
        {label}
      </label>
      <textarea
        id="message"
        name="message"
        required
        minLength={10}
        maxLength={4000}
        rows={6}
        className="input min-h-36"
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? "message-error" : undefined}
      />
      {errors?.length ? (
        <p id="message-error" className="field-error">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm() {
  const { t } = useI18n();
  const f = t.contactForm;
  return (
    <ActionForm action={sendContactMessage} className="mt-4 space-y-4" aria-label={f.form}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.name} name="name" autoComplete="name" required maxLength={120} />
        <Field label={f.email} name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <Field label={f.salon} name="salon" autoComplete="organization" maxLength={120} />
      <Message label={f.message} />
      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <PendingButton pendingLabel={f.sending} className="btn-primary">
        {f.send}
      </PendingButton>
    </ActionForm>
  );
}
