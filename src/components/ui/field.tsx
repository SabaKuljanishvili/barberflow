"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { useFieldErrors } from "./action-form";

type Base = { label: string; name: string; errors?: string[]; hint?: string };

function describedBy(id: string, hint?: string, errors?: string[]) {
  return [hint ? `${id}-hint` : "", errors?.length ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

function Help({ id, hint, errors }: { id: string; hint?: string; errors?: string[] }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="field-error">
          {errors.join(" ")}
        </p>
      ) : null}
    </>
  );
}

/** Labelled input; errors come from props or the surrounding ActionForm. */
export function Field({ label, name, errors, hint, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const ctxErrors = useFieldErrors(name);
  const errs = errors ?? ctxErrors;
  const inputId = id ?? name;
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className="input"
        aria-invalid={errs?.length ? true : undefined}
        aria-describedby={describedBy(inputId, hint, errs)}
        {...rest}
      />
      <Help id={inputId} hint={hint} errors={errs} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  errors,
  hint,
  id,
  children,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const ctxErrors = useFieldErrors(name);
  const errs = errors ?? ctxErrors;
  const selectId = id ?? name;
  return (
    <div>
      <label htmlFor={selectId} className="label">
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        className="input"
        aria-invalid={errs?.length ? true : undefined}
        aria-describedby={describedBy(selectId, hint, errs)}
        {...rest}
      >
        {children}
      </select>
      <Help id={selectId} hint={hint} errors={errs} />
    </div>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-2xl px-4 py-3 text-sm ${state.ok ? "bg-brand-soft text-accent" : "bg-danger-soft text-danger"}`}
    >
      {state.message}
    </p>
  );
}

