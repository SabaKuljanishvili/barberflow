"use client";

import { useId, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import { useFieldErrors } from "@/components/ui/action-form";
import { fmt } from "@/i18n/config";

export type BarberOption = { id: string; name: string };

export type BarberPickerLabels = {
  label: string;
  any: string;
  anyHint: string;
  search: string;
  noMatch: string;
};

/** Case- and accent-insensitive; Georgian has no case, so it passes through. */
function normalize(s: string) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/**
 * Radio list of barbers with an instant name filter. "Any available barber"
 * (an empty value) lets the server assign whoever is free. Filtered-out rows
 * are hidden, not unmounted, so a checked barber stays selected while the
 * user types.
 */
export function BarberPicker({
  barbers,
  allowAny,
  defaultValue = "",
  labels,
}: {
  barbers: BarberOption[];
  allowAny: boolean;
  defaultValue?: string;
  labels: BarberPickerLabels;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const errors = useFieldErrors("staffId") ?? [];
  const q = normalize(query);
  const visible = (b: BarberOption) => !q || normalize(b.name).includes(q);
  const matches = barbers.filter(visible).length;

  return (
    <fieldset aria-describedby={errors.length ? `${id}-error` : undefined}>
      <legend className="label">{labels.label}</legend>

      {barbers.length > 1 && (
        <div className="relative mb-2">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <label htmlFor={`${id}-search`} className="sr-only">
            {labels.search}
          </label>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Enter in a search box would otherwise submit the booking form.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={labels.search}
            autoComplete="off"
            className="input pl-10"
          />
        </div>
      )}

      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-line p-1.5">
        {allowAny && (
          <Option name="staffId" value="" defaultChecked={!defaultValue} hidden={!!q && matches > 0}>
            <Sparkles aria-hidden className="size-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block font-medium">{labels.any}</span>
              <span className="block text-xs text-muted">{labels.anyHint}</span>
            </span>
          </Option>
        )}
        {barbers.map((b) => (
          <Option key={b.id} name="staffId" value={b.id} defaultChecked={defaultValue === b.id} hidden={!visible(b)}>
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-accent">
              {b.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 truncate font-medium">{b.name}</span>
          </Option>
        ))}
        {q && !matches && (
          <p role="status" className="px-3 py-2 text-sm text-muted">
            {fmt(labels.noMatch, { q: query.trim() })}
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <p id={`${id}-error`} className="field-error">
          {errors.join(" ")}
        </p>
      )}
    </fieldset>
  );
}

function Option({
  name,
  value,
  defaultChecked,
  hidden,
  children,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      hidden={hidden}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-canvas has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
    >
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      {children}
      <Check aria-hidden className="ml-auto size-4 shrink-0 text-accent opacity-0 group-has-[:checked]:opacity-100" />
    </label>
  );
}
