"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useFieldErrors } from "./action-form";

type Props = { label: string; name: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with a show/hide toggle. The toggle is a real button with aria-pressed. */
export function PasswordField({ label, name, hint, id, ...rest }: Props) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const errors = useFieldErrors(name);
  const inputId = id ?? name;
  const described = [hint ? `${inputId}-hint` : "", errors?.length ? `${inputId}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={shown ? "text" : "password"}
          className="input pr-12"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={described}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={inputId}
          aria-label={shown ? t.form.hidePassword : t.form.showPassword}
          title={shown ? t.form.hidePassword : t.form.showPassword}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          {shown ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {hint && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${inputId}-error`} className="field-error">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
