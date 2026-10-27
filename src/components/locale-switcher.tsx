"use client";

import { useFormStatus } from "react-dom";
import { Languages } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";

/** Two-option toggle. A plain server-action form, so it also works before hydration. */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  return (
    <form
      action={setLocale}
      className={`inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 ${className}`}
      aria-label={t.switcher.label}
    >
      <Languages aria-hidden className="ml-1.5 size-4 text-muted" />
      {LOCALES.map((l) => (
        <Option key={l} value={l} active={l === locale} />
      ))}
    </form>
  );
}

function Option({ value, active }: { value: Locale; active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="locale"
      value={value}
      lang={value}
      aria-pressed={active}
      disabled={pending}
      className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-brand-900 text-white" : "text-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      {LOCALE_NAMES[value]}
    </button>
  );
}
