"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createAppointment, availableSlots } from "@/app/dashboard/actions";
import { useI18n } from "@/i18n/client";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import {
  dateStrip,
  formatDay,
  isValidPhone,
  keepPicked,
  matchClients,
  resolvePrefill,
  slotChips,
  stripStart,
  type DayNames,
  type FreeSlot,
  type KnownClient,
  type Prefill,
} from "@/lib/appointments-ui";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, phoneCountry, splitE164 } from "@/lib/phone-countries";
import { Sheet } from "./sheet";
import { colorVar, type BarberVM, type Hours, type Labels, type ServiceVM } from "./types";

export type BookingData = {
  services: ServiceVM[];
  /** Barbers this user may book: everyone for a manager, only themself for a barber. */
  barbers: BarberVM[];
  clients: KnownClient[];
  hours: Hours;
  todayIso: string;
  dayNames: DayNames;
  isManager: boolean;
  userId: string;
};

export type Booked = { date: string; time: string; phoneDigits: string };

/** The "New booking" slide-over. State starts fresh (from `prefill`) every time it opens. */
export function BookingDrawer({
  open,
  prefill,
  data,
  labels,
  onClose,
  onBooked,
}: {
  open: boolean;
  prefill: Prefill;
  data: BookingData;
  labels: Labels;
  onClose: () => void;
  onBooked: (b: Booked) => void;
}) {
  if (!open) return null;
  return <BookingForm prefill={prefill} data={data} labels={labels} onClose={onClose} onBooked={onBooked} />;
}

const chip = "flex cursor-pointer items-center rounded-[10px] border text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
const chipOff = "border-ap-chip-line text-ap-ink2 hover:border-ap-sel-line";
const chipOn = "border-ap-sel-line bg-ap-sel font-bold text-ap-ink";

function BookingForm({
  prefill,
  data,
  labels: p,
  onClose,
  onBooked,
}: {
  prefill: Prefill;
  data: BookingData;
  labels: Labels;
  onClose: () => void;
  onBooked: (b: Booked) => void;
}) {
  const { locale, t } = useI18n();
  const intl = INTL_LOCALE[locale];
  const formId = useId();
  const { services, barbers, clients, hours, todayIso, isManager, userId } = data;

  const strip = useMemo(() => dateStrip(stripStart(todayIso, prefill.date), hours), [todayIso, prefill.date, hours]);
  const initial = useMemo(
    () => resolvePrefill(prefill, { isManager, userId, barberIds: barbers.map((b) => b.id), todayIso, strip }),
    // Only on open: the drawer is remounted each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialPhone = splitE164(prefill.phone);

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(initial.staffId);
  const [date, setDate] = useState(initial.date);
  const [chosenTime, setTime] = useState(initial.time);
  const [country, setCountry] = useState(prefill.phone ? initialPhone.iso : DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState(prefill.phone ? initialPhone.national : "");
  const [name, setName] = useState(prefill.name ?? "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const [free, setFree] = useState<FreeSlot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, startLoading] = useTransition();
  const [version, setVersion] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);
  const chips = useMemo(
    () => (service ? slotChips({ opensAt: hours.opensAt, closesAt: hours.closesAt, durationMinutes: service.duration, free, staffId }) : []),
    [service, hours, free, staffId],
  );

  // Free times from the same engine as the voice agent (availableSlots).
  useEffect(() => {
    if (!serviceId || !date) return;
    let live = true;
    startLoading(async () => {
      const result = await availableSlots({ serviceId, staffId, date });
      if (!live) return;
      setFailed(result === null);
      setFree(result ?? []);
    });
    return () => {
      live = false;
    };
  }, [serviceId, staffId, date, version]);

  // A picked time that is no longer free (other service, barber or day) is dropped.
  const time = !loading && free ? keepPicked(chosenTime, chips) : chosenTime;

  const dial = phoneCountry(country)?.dial;
  const phoneOk = isValidPhone(country, dial, phone);
  const ready = !!service && !!time && phoneOk && !loading;
  const suggestions = useMemo(() => (suggestOpen ? matchClients(clients, { name, phone }) : []), [clients, name, phone, suggestOpen]);
  const barberName = staffId ? barbers.find((b) => b.id === staffId)?.name : p.anyBarber;
  const day = (iso: string, style: Parameters<typeof formatDay>[2]) => formatDay(iso, data.dayNames, style);
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([intl], { type: "region" });
    } catch {
      return null;
    }
  }, [intl]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhoneTouched(true);
    if (!ready || submitting) return;
    const [hour, minute] = time.split(":");
    const fd = new FormData();
    fd.set("serviceId", serviceId);
    fd.set("staffId", staffId);
    fd.set("localTimeDate", date);
    fd.set("localTimeHour", hour);
    fd.set("localTimeMinute", minute);
    fd.set("phoneNumber", phone);
    fd.set("phoneNumberCountry", country);
    fd.set("clientName", name.trim());
    setError(null);
    setPhoneError(null);
    startSubmit(async () => {
      let result: Awaited<ReturnType<typeof createAppointment>> = null;
      try {
        result = await createAppointment(null, fd);
      } catch {
        result = null;
      }
      if (result?.ok) {
        const digits = phone.trim().startsWith("+") ? phone.replace(/\D/g, "") : `${dial ?? ""}${phone.replace(/\D/g, "").replace(/^0+/, "")}`;
        onBooked({ date, time, phoneDigits: digits });
        return;
      }
      const fieldPhone = result?.fieldErrors?.phoneNumber?.join(" ");
      if (fieldPhone) setPhoneError(fieldPhone);
      setError(fieldPhone ? null : (result?.message ?? p.saveFailed));
      // The time may have just been taken: ask the engine again.
      setVersion((v) => v + 1);
    });
  }

  const summary = service && time ? (
    <>
      {service.name} · {barberName} · {day(date, "short")}, <b className="text-ap-ink">{time}</b>
    </>
  ) : (
    p.summaryEmpty
  );

  const footer = (
    <div className="flex flex-col gap-2">
      <p className="truncate text-xs text-ap-muted" aria-live="polite">
        {summary}
      </p>
      <button
        type="submit"
        form={formId}
        disabled={!ready || submitting}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-ap-on-green hover:bg-brand-hi disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {submitting ? p.booking : p.bookButton}
      </button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} label={p.newBooking} closeLabel={p.close} footer={footer}>
      {services.length === 0 ? (
        <p className="text-sm text-ap-muted">{p.needData}</p>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold">1. {p.stepService}</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((s, i) => (
                <label key={s.id} className={`${chip} h-10 gap-1.5 px-3 ${s.id === serviceId ? chipOn : chipOff}`}>
                  <input type="radio" name="service" value={s.id} checked={s.id === serviceId} onChange={() => setServiceId(s.id)} className="sr-only" data-autofocus={i === 0 ? true : undefined} />
                  {s.name}
                  <span className={`font-medium ${s.id === serviceId ? "text-ap-muted" : "text-ap-faint"}`}>
                    {fmt(p.minutes, { n: s.duration })} · {fmt(p.price, { n: s.price })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold">2. {p.stepBarber}</legend>
            <div className="grid grid-cols-3 gap-2">
              {isManager && (
                <label className={`${chip} h-[54px] gap-2 px-2.5 text-xs ${staffId === "" ? chipOn : chipOff}`}>
                  <input type="radio" name="barber" value="" checked={staffId === ""} onChange={() => setStaffId("")} className="sr-only" />
                  <span aria-hidden>✱</span>
                  <span className="min-w-0 truncate">{p.any}</span>
                </label>
              )}
              {barbers.map((b) => (
                <label key={b.id} className={`${chip} h-[54px] gap-2 px-2.5 text-xs ${staffId === b.id ? chipOn : chipOff}`}>
                  <input type="radio" name="barber" value={b.id} checked={staffId === b.id} onChange={() => setStaffId(b.id)} className="sr-only" />
                  <Avatar barber={b} size={26} />
                  <span className="min-w-0 truncate">{b.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold">3. {p.stepWhen}</legend>
            <div role="radiogroup" aria-label={p.days} className="grid grid-cols-7 gap-1.5">
              {strip.map((c) => {
                const on = c.iso === date;
                return (
                  <label
                    key={c.iso}
                    className={`flex h-[52px] flex-col items-center justify-center rounded-[10px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                      c.closed
                        ? "cursor-not-allowed border border-dashed border-ap-drawer-line text-ap-faint"
                        : on
                          ? "cursor-pointer bg-brand text-ap-on-green"
                          : "cursor-pointer border border-ap-chip-line text-ap-ink2 hover:border-ap-sel-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="date"
                      value={c.iso}
                      checked={on}
                      disabled={c.closed}
                      onChange={() => setDate(c.iso)}
                      aria-label={`${day(c.iso, "long")}${c.closed ? ` — ${p.closed}` : ""}`}
                      className="sr-only"
                    />
                    <span aria-hidden className="text-[10px] opacity-90">
                      {day(c.iso, "weekday")}
                    </span>
                    <b aria-hidden className="text-[15px]">
                      {day(c.iso, "day")}
                    </b>
                  </label>
                );
              })}
            </div>
            <div aria-live="polite" aria-busy={loading} className="mt-1">
              {failed ? (
                <p className="text-sm text-danger">{p.slotsFailed}</p>
              ) : (
                <>
                  <div role="radiogroup" aria-label={p.freeTimes} className={`grid grid-cols-5 gap-1.5 transition-opacity ${loading ? "opacity-50" : ""}`}>
                    {chips.map((c) => {
                      const on = c.time === time;
                      const off = !c.available || loading;
                      return (
                        <label
                          key={c.time}
                          className={`flex h-10 items-center justify-center rounded-[9px] border text-[13px] font-semibold tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                            on
                              ? "cursor-pointer border-brand bg-brand text-ap-on-green"
                              : !c.available
                                ? "cursor-not-allowed border-ap-hour text-ap-faint line-through"
                                : "cursor-pointer border-ap-chip-line bg-ap-bg text-ap-ink hover:border-ap-sel-line"
                          }`}
                        >
                          <input
                            type="radio"
                            name="time"
                            value={c.time}
                            checked={on}
                            disabled={off && !on}
                            onChange={() => setTime(c.time)}
                            aria-label={c.available ? c.time : fmt(p.unavailable, { time: c.time })}
                            className="sr-only"
                          />
                          {c.time}
                        </label>
                      );
                    })}
                  </div>
                  {loading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-ap-muted">
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                      {p.loadingSlots}
                    </p>
                  ) : free && chips.length > 0 && !chips.some((c) => c.available) ? (
                    <p className="mt-2 text-xs text-ap-muted">{p.noSlots}</p>
                  ) : null}
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold">4. {p.stepClient}</legend>
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label={fmt(t.form.countryCode, { label: p.phoneLabel })}
                className="h-[42px] rounded-[10px] border border-ap-line2 bg-ap-bg px-2.5 text-[13px] text-ap-ink focus:border-accent"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.iso} title={regionNames?.of(c.iso) ?? c.name} suppressHydrationWarning>
                    +{c.dial} {c.iso}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                  setSuggestOpen(true);
                }}
                onBlur={() => setPhoneTouched(true)}
                placeholder="555 12 34 56"
                aria-label={p.phoneLabel}
                aria-invalid={(phoneTouched && !phoneOk) || !!phoneError ? true : undefined}
                aria-describedby={`${formId}-phone-err`}
                className="h-[42px] min-w-0 rounded-[10px] border border-ap-line2 bg-ap-bg px-3 text-[13px] text-ap-ink placeholder:text-ap-faint focus:border-accent"
              />
            </div>
            <p id={`${formId}-phone-err`} className="text-xs text-danger" aria-live="polite">
              {phoneError ?? (phoneTouched && phone && !phoneOk ? p.phoneInvalid : "")}
            </p>
            <input
              type="text"
              autoComplete="off"
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSuggestOpen(true);
              }}
              placeholder={p.namePlaceholder}
              aria-label={p.clientNameOptional}
              className="h-[42px] min-w-0 rounded-[10px] border border-ap-line2 bg-ap-bg px-3 text-[13px] text-ap-ink placeholder:text-ap-faint focus:border-accent"
            />
            {suggestions.length > 0 && (
              <ul aria-label={p.known} className="flex flex-col gap-1 rounded-xl border border-ap-line bg-ap-bg p-1">
                {suggestions.map((c) => (
                  <li key={`${c.phone}-${c.name}`}>
                    <button
                      type="button"
                      aria-label={fmt(p.pickClient, { name: c.name, phone: c.phone })}
                      onClick={() => {
                        const { iso, national } = splitE164(c.phone);
                        setCountry(iso);
                        setPhone(national);
                        setName(c.name);
                        setSuggestOpen(false);
                        setPhoneTouched(true);
                      }}
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-[9px] px-2.5 text-left text-[13px] hover:bg-ap-row"
                    >
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="shrink-0 text-xs text-ap-muted tabular-nums">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </form>
      )}
    </Sheet>
  );
}

export function Avatar({ barber, size = 30 }: { barber: Pick<BarberVM, "initials" | "color">; size?: number }) {
  const c = colorVar(barber.color);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center font-extrabold"
      style={{
        width: size,
        height: size,
        borderRadius: size > 28 ? 9 : 8,
        fontSize: size > 28 ? 11 : 10,
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
      }}
    >
      {barber.initials}
    </span>
  );
}
