"use client";

import { useFormStatus } from "react-dom";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_CODES, LOCALE_NAMES, type Locale } from "@/i18n/config";

/**
 * Compact segmented "GE | EN" toggle with a sliding thumb. Short codes keep it
 * small; each button still carries the language's full name for screen
 * readers and as a tooltip. A plain server-action form, so it also works
 * before hydration.
 */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const index = LOCALES.indexOf(locale);
  return (
    <form
      action={setLocale}
      className={`relative inline-grid shrink-0 grid-cols-2 rounded-full border border-line p-[3px] ${className}`}
      aria-label={t.switcher.label}
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-ink transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
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
      aria-label={LOCALE_NAMES[value]}
      title={LOCALE_NAMES[value]}
      disabled={pending}
      className={`relative z-10 min-w-9 rounded-full px-2.5 py-1 text-xs leading-[1.65] font-bold transition-colors duration-300 ${
        active ? "text-canvas" : "text-muted hover:text-ink"
      } ${pending && !active ? "opacity-60" : ""}`}
    >
      {LOCALE_CODES[value]}
    </button>
  );
}
