"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldErrors } from "@/components/ui/action-form";
import { availableSlots } from "@/app/dashboard/actions";

type Labels = { label: string; date: string; pickService: string; loading: string; none: string; failed: string; slotsFor: string };

/**
 * Date + free-time chips for the booking form. Reads the service and barber
 * from the surrounding form, asks the server (same availability engine as
 * the voice agent) and submits the choice as `${name}Date/Hour/Minute`, the
 * shape withDateTime() expects. The server still re-checks on submit.
 */
export function SlotPicker({
  name,
  defaultDate,
  defaultTime = "",
  minDate,
  hint,
  labels,
}: {
  name: string;
  defaultDate: string;
  defaultTime?: string;
  minDate: string;
  hint?: string;
  labels: Labels;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const errs = useFieldErrors(name);
  const [date, setDate] = useState(defaultDate);
  const [query, setQuery] = useState<{ serviceId: string; staffId: string } | null>(null);
  const [slots, setSlots] = useState<{ time: string; staffIds: string[] }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(defaultTime);
  const [pending, start] = useTransition();

  // Follow the service and barber selects of the same form.
  useEffect(() => {
    const form = ref.current?.form ?? ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const data = new FormData(form);
      setQuery({ serviceId: String(data.get("serviceId") ?? ""), staffId: String(data.get("staffId") ?? "") });
    };
    read();
    form.addEventListener("change", read);
    // A successful booking resets the form: refresh the free times.
    form.addEventListener("reset", () => setTimeout(read, 0));
    return () => form.removeEventListener("change", read);
  }, []);

  const serviceId = query?.serviceId ?? "";
  const staffId = query?.staffId ?? "";
  useEffect(() => {
    if (!serviceId || !date) return;
    let live = true;
    start(async () => {
      const result = await availableSlots({ serviceId, staffId, date });
      if (!live) return;
      setFailed(result === null);
      setSlots(result ?? []);
      setPicked((p) => (result?.some((s) => s.time === p) ? p : ""));
    });
    return () => {
      live = false;
    };
  }, [serviceId, staffId, date]);

  const [hour, minute] = picked ? picked.split(":") : ["", ""];
  const describedBy = [hint ? `${name}-hint` : "", errs?.length ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset ref={ref} aria-describedby={describedBy}>
      <legend className="label">{labels.label}</legend>
      <input
        name={`${name}Date`}
        type="date"
        value={date}
        min={minDate}
        required
        onChange={(e) => setDate(e.target.value)}
        aria-label={labels.date}
        className="input"
      />
      <input type="hidden" name={`${name}Hour`} value={hour} />
      <input type="hidden" name={`${name}Minute`} value={minute} />
      <div className="mt-3" aria-live="polite" aria-busy={pending}>
        {!serviceId ? (
          <p className="text-sm text-muted">{labels.pickService}</p>
        ) : pending && !slots ? (
          <p className="text-sm text-muted">{labels.loading}</p>
        ) : failed ? (
          <p className="text-sm text-danger">{labels.failed}</p>
        ) : slots && slots.length === 0 ? (
          <p className="text-sm text-muted">{labels.none}</p>
        ) : (
          <div role="radiogroup" aria-label={labels.slotsFor} className={`flex flex-wrap gap-2 ${pending ? "opacity-60" : ""}`}>
            {(slots ?? []).map((s) => (
              <label
                key={s.time}
                className="cursor-pointer rounded-xl border border-line px-3 py-1.5 text-sm font-medium tabular-nums has-[:checked]:border-accent has-[:checked]:bg-brand has-[:checked]:text-on-brand has-[:focus-visible]:outline-2"
              >
                <input type="radio" name={`${name}Slot`} value={s.time} checked={picked === s.time} onChange={() => setPicked(s.time)} className="sr-only" />
                {s.time}
              </label>
            ))}
          </div>
        )}
      </div>
      {hint && (
        <p id={`${name}-hint`} className="mt-2 text-xs text-muted">
          {hint}
        </p>
      )}
      {errs?.length ? (
        <p id={`${name}-error`} className="field-error">
          {errs.join(" ")}
        </p>
      ) : null}
    </fieldset>
  );
}
