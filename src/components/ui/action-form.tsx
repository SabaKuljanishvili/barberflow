"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import type { FormState } from "@/lib/validation";
import { FormMessage } from "./field";

const FormStateContext = createContext<{ state: FormState; pending: boolean }>({ state: null, pending: false });

export function useFieldErrors(name: string): string[] | undefined {
  return useContext(FormStateContext).state?.fieldErrors?.[name];
}

export function useFormPending(): boolean {
  return useContext(FormStateContext).pending;
}

/**
 * Wraps a server action. Submits via a transition instead of the native form
 * action so React does not clear what the user typed when validation fails;
 * the form is reset only after a successful save.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
  showMessage = true,
  "aria-label": ariaLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showMessage?: boolean;
  "aria-label"?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormStateContext.Provider value={{ state, pending }}>
      <form
        ref={ref}
        className={className}
        aria-label={ariaLabel}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => dispatch(data));
        }}
      >
        {showMessage && <FormMessage state={state} />}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function PendingButton({
  children,
  pendingLabel,
  className = "btn-primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const pending = useFormPending();
  const { t } = useI18n();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} {...rest}>
      {pending ? (pendingLabel ?? t.form.saving) : children}
    </button>
  );
}
