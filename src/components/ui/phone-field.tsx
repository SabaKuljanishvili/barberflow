"use client";

import { useMemo, type InputHTMLAttributes } from "react";
import { useI18n } from "@/i18n/client";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { PHONE_COUNTRIES, flagEmoji, splitE164 } from "@/lib/phone-countries";
import { useFieldErrors } from "./action-form";

/**
 * Country code selector plus national number. Posts `${name}Country` (ISO
 * code) and `name` (as typed); the server joins them with `withDialCode`.
 * Both controls are uncontrolled so ActionForm's reset restores defaults.
 */
export function PhoneField({
  label,
  name,
  hint,
  defaultValue,
  id,
  ...rest
}: { label: string; name: string; hint?: string; defaultValue?: string | null } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "type"
>) {
  const errs = useFieldErrors(name);
  const { locale, t } = useI18n();
  // Country names in the page language; the English list name is the fallback.
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);
  const inputId = id ?? name;
  const initial = splitE164(defaultValue);
  const describedBy = [hint ? `${inputId}-hint` : "", errs?.length ? `${inputId}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          name={`${name}Country`}
          defaultValue={initial.iso}
          aria-label={fmt(t.form.countryCode, { label })}
          className="input w-32 shrink-0 truncate px-3"
        >
          {PHONE_COUNTRIES.map((c) => (
            // Browser and server ICU can name a region differently.
            <option key={c.iso} value={c.iso} title={regionNames?.of(c.iso) ?? c.name} suppressHydrationWarning>
              {flagEmoji(c.iso)} +{c.dial} {regionNames?.of(c.iso) ?? c.name}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="tel"
          defaultValue={initial.national}
          placeholder="555 12 34 56"
          className="input min-w-0 flex-1"
          aria-invalid={errs?.length ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
      {hint && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {errs?.length ? (
        <p id={`${inputId}-error`} className="field-error">
          {errs.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
