"use client";

import { useFormStatus } from "react-dom";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_CODES, LOCALE_NAMES, type Locale } from "@/i18n/config";

/**
 * Compact segmented "GE | EN" toggle with a sliding thumb. Short codes keep it
 * small; each button still carries the language's full name for screen
 * readers and as a tooltip. A plain server-action form, so it also works
 * before hydration. "square" is the marketing header's look (10px corners
 * on the page background); "pill" is used everywhere else.
 */
export function LocaleSwitcher({ className = "", variant = "pill" }: { className?: string; variant?: "pill" | "square" }) {
  const { locale, t } = useI18n();
  const index = LOCALES.indexOf(locale);
  const square = variant === "square";
  return (
    <form
      action={setLocale}
      className={`relative inline-grid shrink-0 grid-cols-2 border p-[3px] ${
        square ? "rounded-[10px] border-[var(--hero-line)] bg-canvas" : "rounded-full border-line"
      } ${className}`}
      aria-label={t.switcher.label}
      onSubmit={(e) => {
        // Marketing pages switch URL (/ and /en); the action needs the current one.
        const input = e.currentTarget.elements.namedItem("path");
        if (input instanceof HTMLInputElement) input.value = location.pathname + location.hash;
      }}
    >
      <input type="hidden" name="path" defaultValue="" />
      <span
        aria-hidden
        className={`absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] transition-transform duration-300 ease-out ${
          square ? "rounded-[7px] bg-[var(--hero-ink)]" : "rounded-full bg-ink"
        }`}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {LOCALES.map((l) => (
        <Option key={l} value={l} active={l === locale} square={square} />
      ))}
    </form>
  );
}

function Option({ value, active, square }: { value: Locale; active: boolean; square: boolean }) {
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
      className={`relative z-10 min-w-9 ${square ? "rounded-[7px]" : "rounded-full"} px-2.5 py-1 text-xs leading-[1.65] font-bold transition-colors duration-300 ${
        active ? "text-canvas" : "text-muted hover:text-ink"
      } ${pending && !active ? "opacity-60" : ""}`}
    >
      {LOCALE_CODES[value]}
    </button>
  );
}
