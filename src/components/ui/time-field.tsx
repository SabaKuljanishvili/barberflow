"use client";

import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { useFieldErrors } from "./action-form";

// 24-hour pickers built from selects. Native <input type="time"> and
// "datetime-local" follow the browser locale and show AM/PM for many users.
// Controls are uncontrolled so ActionForm's reset restores the defaults; the
// server joins the parts with withTime() / withDateTime().

const pad = (n: number) => String(n).padStart(2, "0");

function minuteOptions(step: number, current: number): number[] {
  const list = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  // Keep a stored value that is off the grid (e.g. 09:05 with 15-minute steps).
  return list.includes(current) ? list : [...list, current].sort((a, b) => a - b);
}

function TimeSelects({
  id,
  name,
  label,
  defaultValue,
  stepMinutes,
  invalid,
  describedBy,
  minHour = 0,
  maxHour = 23,
}: {
  minHour?: number;
  maxHour?: number;
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  stepMinutes: number;
  invalid: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const [h, m] = defaultValue.split(":").map(Number);
  const hour = Math.min(maxHour, Math.max(minHour, Number.isFinite(h) ? h : minHour));
  const minute = Number.isFinite(m) ? m : 0;
  const common = {
    className: "input w-auto px-3 tabular-nums",
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as const;
  return (
    <div className="flex items-center gap-1.5">
      <select id={id} name={`${name}Hour`} defaultValue={pad(hour)} aria-label={fmt(t.form.hour, { label })} {...common}>
        {Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour).map((i) => (
          <option key={i} value={pad(i)}>
            {pad(i)}
          </option>
        ))}
      </select>
      <span aria-hidden className="font-semibold text-muted">
        :
      </span>
      <select name={`${name}Minute`} defaultValue={pad(minute)} aria-label={fmt(t.form.minute, { label })} {...common}>
        {minuteOptions(stepMinutes, minute).map((n) => (
          <option key={n} value={pad(n)}>
            {pad(n)}
          </option>
        ))}
      </select>
    </div>
  );
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

function describedBy(id: string, hint?: string, errors?: string[]) {
  return [hint ? `${id}-hint` : "", errors?.length ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

/** "HH:MM" time of day. Posts `${name}Hour` and `${name}Minute`. */
export function TimeField({
  label,
  name,
  defaultValue,
  hint,
  stepMinutes = 15,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  stepMinutes?: number;
}) {
  const errs = useFieldErrors(name);
  const id = `${name}Hour`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <TimeSelects
        id={id}
        name={name}
        label={label}
        defaultValue={defaultValue}
        stepMinutes={stepMinutes}
        invalid={!!errs?.length}
        describedBy={describedBy(name, hint, errs)}
      />
      <Help id={name} hint={hint} errors={errs} />
    </div>
  );
}

/**
 * Date plus 24-hour time. Posts `${name}Date` (YYYY-MM-DD) and the
 * TimeField parts; `defaultValue` and `min` use "YYYY-MM-DDTHH:MM".
 */
export function DateTimeField({
  label,
  dateLabel,
  name,
  defaultValue,
  min,
  hint,
  stepMinutes = 15,
  minHour,
  maxHour,
}: {
  /** Limit the hour select, e.g. to the salon's opening hours. */
  minHour?: number;
  maxHour?: number;
  label: string;
  dateLabel: string;
  name: string;
  defaultValue: string;
  min?: string;
  hint?: string;
  stepMinutes?: number;
}) {
  const errs = useFieldErrors(name);
  const [date, time] = defaultValue.split("T");
  const dateId = `${name}Date`;
  const desc = describedBy(name, hint, errs);
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <input
          id={dateId}
          name={dateId}
          type="date"
          defaultValue={date}
          min={min?.split("T")[0]}
          aria-label={dateLabel}
          aria-invalid={errs?.length ? true : undefined}
          aria-describedby={desc}
          className="input w-auto min-w-0 flex-1"
        />
        <TimeSelects
          id={`${name}Hour`}
          name={name}
          label={label}
          defaultValue={time ?? ""}
          stepMinutes={stepMinutes}
          invalid={!!errs?.length}
          describedBy={desc}
          minHour={minHour}
          maxHour={maxHour}
        />
      </div>
      <Help id={name} hint={hint} errors={errs} />
    </fieldset>
  );
}
