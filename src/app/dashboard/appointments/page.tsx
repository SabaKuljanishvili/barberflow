import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BarberPicker } from "@/components/dashboard/barber-picker";
import { BookingClientFields } from "@/components/dashboard/booking-client-fields";
import { SlotPicker } from "@/components/dashboard/slot-picker";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { AutoSubmitForm } from "@/components/ui/auto-submit-form";
import { SelectField } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { blockPosition, dayRows, isIsoDate, isoWeekday, shiftDate, weekDates } from "@/lib/calendar";
import { clientName } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findOpenSlots, formatInZone, timeZoneLabel, toLocalInputValue, zonedDayBounds, zonedToUtc } from "@/lib/time";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { createAppointment, rescheduleAppointment, updateAppointmentStatus } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.appointments.title };
}

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled"];
const VIEWS = ["day", "week", "list"] as const;
type View = (typeof VIEWS)[number];
const ROW_PX = 48;
const ROW_MIN = 30;

type Sp = { view?: string; date?: string; status?: string; range?: string; client?: string; staff?: string; time?: string; appt?: string };

const SELECT = "id, appointment_time, ends_at, status, source, staff_id, client_id, service_id, clients(first_name, last_name, phone_number), services(name, duration_minutes), profiles(full_name)";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const { salon, userId, isManager } = await requireUser();
  const { locale, t } = await getI18n();
  const p = t.dashboard.appointments;
  const intl = INTL_LOCALE[locale];
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "day";
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;
  const range = sp.range === "past" ? "past" : "upcoming";

  const now = new Date();
  const todayIso = toLocalInputValue(now, salon.timezone).split("T")[0];
  const date = isIsoDate(sp.date) ? sp.date : todayIso;
  const supabase = await createSupabaseServerClient();

  // Time window of the current view, in salon time.
  const [y, m, d] = date.split("-").map(Number);
  const week = weekDates(date);
  const windowStart = view === "week" ? zonedToUtc(...isoParts(week[0]), 0, 0, salon.timezone) : zonedToUtc(y, m, d, 0, 0, salon.timezone);
  const windowEnd = view === "week" ? zonedToUtc(...isoParts(shiftDate(week[6], 1)), 0, 0, salon.timezone) : zonedToUtc(y, m, d + 1, 0, 0, salon.timezone);
  const startOfToday = zonedDayBounds(now, salon.timezone).start.toISOString();

  let listQuery = supabase.from("appointments").select(SELECT).limit(100);
  listQuery =
    range === "past"
      ? listQuery.lt("appointment_time", startOfToday).order("appointment_time", { ascending: false })
      : listQuery.gte("appointment_time", startOfToday).order("appointment_time");
  if (status) listQuery = listQuery.eq("status", status);
  const calendarQuery = supabase
    .from("appointments")
    .select(SELECT)
    .neq("status", "cancelled")
    .gte("ends_at", windowStart.toISOString())
    .lt("appointment_time", windowEnd.toISOString())
    .order("appointment_time");

  const [appts, clients, staff, services, detail] = await Promise.all([
    view === "list" ? listQuery : calendarQuery,
    supabase.from("clients").select("id, first_name, last_name, phone_number").order("first_name").limit(500),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("services").select("id, name, duration_minutes").eq("active", true).order("sort_order").order("name"),
    sp.appt ? supabase.from("appointments").select(SELECT).eq("id", sp.appt).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const rows = appts.data ?? [];
  const barbers = staff.data ?? [];
  const bookableStaff = barbers.filter((s) => isManager || s.id === userId);
  const knownClients = (clients.data ?? [])
    .filter((c) => c.first_name)
    .map((c) => ({ id: c.id, name: clientName(c, ""), phone: c.phone_number ?? "" }));
  const preselected = knownClients.find((c) => c.id === sp.client);
  const presetStaff = bookableStaff.some((s) => s.id === sp.staff) ? sp.staff : undefined;

  const hours = { opensAt: salon.opens_at, closesAt: salon.closes_at, workingDays: salon.working_days };
  const [firstOpen] = findOpenSlots({ ...hours, from: now, timeZone: salon.timezone, durationMinutes: 15, busy: [], count: 1, stepMinutes: 15, leadMinutes: 0 });
  const nextSlotDate = toLocalInputValue(firstOpen ?? now, salon.timezone).split("T")[0];
  const bookDate = view === "day" && date >= todayIso ? date : nextSlotDate;
  const timeHint = fmt(p.shopTime, {
    zone: timeZoneLabel(salon.timezone, t.dashboard.tbilisi),
    now: formatInZone(now, salon.timezone, { dateStyle: undefined }, intl),
    opens: salon.opens_at.slice(0, 5),
    closes: salon.closes_at.slice(0, 5),
  });

  const href = (q: Partial<Sp>) => {
    const params = new URLSearchParams();
    const merged: Sp = { view, date, ...q };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/dashboard/appointments?${params}`;
  };
  const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intl, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));
  const name = (a: (typeof rows)[number]) => clientName(a.clients, t.dashboard.unknownClient);
  const canEdit = (staffId: string) => isManager || staffId === userId;
  const selected = detail.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/appointments", label: p.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{p.intro}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="list" className="card min-w-0 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={p.views} className="inline-flex rounded-2xl border border-line p-1">
              {VIEWS.map((v) => (
                <Link
                  key={v}
                  href={href({ view: v, appt: undefined })}
                  aria-current={v === view ? "page" : undefined}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium ${v === view ? "bg-brand text-on-brand" : "text-muted hover:text-ink"}`}
                >
                  {v === "day" ? p.viewDay : v === "week" ? p.viewWeek : p.viewList}
                </Link>
              ))}
            </nav>
            {view !== "list" ? (
              <div className="flex items-center gap-1">
                <Link href={href({ date: shiftDate(date, view === "week" ? -7 : -1) })} className="btn-secondary px-2.5" aria-label={view === "week" ? p.prevWeek : p.prevDay}>
                  <ChevronLeft aria-hidden className="size-4" />
                </Link>
                <Link href={href({ date: todayIso })} className="btn-secondary">
                  {p.today}
                </Link>
                <Link href={href({ date: shiftDate(date, view === "week" ? 7 : 1) })} className="btn-secondary px-2.5" aria-label={view === "week" ? p.nextWeek : p.nextDay}>
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </div>
            ) : (
              <AutoSubmitForm className="flex flex-wrap items-end gap-2" label={p.filter} submitLabel={p.apply}>
                <input type="hidden" name="view" value="list" />
                <label htmlFor="range" className="sr-only">
                  {p.range}
                </label>
                <select id="range" name="range" defaultValue={range} className="input w-auto">
                  <option value="upcoming">{p.rangeUpcoming}</option>
                  <option value="past">{p.rangePast}</option>
                </select>
                <label htmlFor="status" className="sr-only">
                  {p.status}
                </label>
                <select id="status" name="status" defaultValue={status ?? ""} className="input w-auto">
                  <option value="">{p.allStatuses}</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t.status[s]}
                    </option>
                  ))}
                </select>
              </AutoSubmitForm>
            )}
          </div>

          <h2 id="list" className="mt-4 text-lg font-semibold">
            {view === "list"
              ? range === "past"
                ? p.past
                : p.upcoming
              : view === "week"
                ? `${dayLabel(week[0], { day: "numeric", month: "short" })} – ${dayLabel(week[6], { day: "numeric", month: "short", year: "numeric" })}`
                : dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}
          </h2>

          {view === "day" && (
            <DayGrid
              date={date}
              isToday={date === todayIso}
              now={now}
              timeZone={salon.timezone}
              opensAt={salon.opens_at}
              closesAt={salon.closes_at}
              closed={!salon.working_days.includes(isoWeekday(date))}
              barbers={barbers}
              bookable={new Set(bookableStaff.map((b) => b.id))}
              appts={rows.map((a) => ({
                id: a.id,
                staffId: a.staff_id,
                start: new Date(a.appointment_time),
                end: new Date(a.ends_at),
                status: a.status,
                label: `${formatInZone(a.appointment_time, salon.timezone, { dateStyle: undefined, timeStyle: "short" }, intl)} ${name(a)}`,
                sub: a.services?.name ?? "",
                href: href({ appt: a.id }),
              }))}
              slotHref={(staffId, time) => href({ staff: staffId, time, appt: undefined }) + "#book"}
              labels={p}
            />
          )}

          {view === "week" && (
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
              {week.map((iso) => {
                const { start, end } = { start: zonedToUtc(...isoParts(iso), 0, 0, salon.timezone), end: zonedToUtc(...isoParts(shiftDate(iso, 1)), 0, 0, salon.timezone) };
                const dayAppts = rows.filter((a) => new Date(a.appointment_time) >= start && new Date(a.appointment_time) < end);
                return (
                  <li key={iso} className={`rounded-2xl border p-3 ${iso === todayIso ? "border-accent" : "border-line"}`}>
                    <Link href={href({ view: "day", date: iso })} className="flex items-baseline justify-between gap-2 font-semibold hover:text-accent" aria-label={fmt(p.openDay, { date: dayLabel(iso, { dateStyle: "full" }) })}>
                      <span>{dayLabel(iso, { weekday: "short" })}</span>
                      <span className="text-sm tabular-nums text-muted">{dayLabel(iso, { day: "numeric", month: "short" })}</span>
                    </Link>
                    {dayAppts.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {dayAppts.map((a) => (
                          <li key={a.id}>
                            <Link href={href({ appt: a.id })} className="block rounded-xl bg-canvas px-2 py-1.5 text-xs hover:bg-brand-soft">
                              <span className="font-semibold tabular-nums">{formatInZone(a.appointment_time, salon.timezone, { dateStyle: undefined, timeStyle: "short" }, intl)}</span>{" "}
                              {name(a)}
                              <span className="block truncate text-muted">{a.profiles?.full_name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted">{salon.working_days.includes(isoWeekday(iso)) ? p.dayEmpty : p.closedDay}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {view === "list" &&
            (rows.length ? (
              <>
                {/* Phones: stacked cards. md and up: the table. */}
                <ul className="mt-4 divide-y divide-line md:hidden">
                  {rows.map((a) => (
                    <li key={a.id} className="py-3">
                      <Link href={href({ appt: a.id })} className="block">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{name(a)}</p>
                            <p className="text-sm text-muted">
                              <time dateTime={a.appointment_time}>{formatInZone(a.appointment_time, salon.timezone, {}, intl)}</time>
                            </p>
                            <p className="truncate text-sm text-muted">
                              {a.services?.name} · {fmt(p.with, { name: a.profiles?.full_name ?? "" })}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">{p.title}</caption>
                    <thead className="text-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="py-3 pr-4 font-medium">{p.when}</th>
                        <th scope="col" className="py-3 pr-4 font-medium">{p.client}</th>
                        <th scope="col" className="py-3 pr-4 font-medium">{p.service}</th>
                        <th scope="col" className="py-3 pr-4 font-medium">{p.status}</th>
                        <th scope="col" className="py-3 font-medium">
                          <span className="sr-only">{p.updateStatus}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.id} className="border-b border-line align-top last:border-0">
                          <td className="py-3 pr-4 whitespace-nowrap">
                            <time dateTime={a.appointment_time}>{formatInZone(a.appointment_time, salon.timezone, {}, intl)}</time>
                            {a.source === "voice" && <span className="block text-xs text-accent">{p.byPhone}</span>}
                          </td>
                          <td className="py-3 pr-4">
                            <Link href={`/dashboard/clients/${a.client_id}`} className="font-medium hover:text-accent">
                              {name(a)}
                            </Link>
                            <span className="block text-xs text-muted">{a.clients?.phone_number}</span>
                          </td>
                          <td className="py-3 pr-4">
                            {a.services?.name}
                            <span className="block text-xs text-muted">{fmt(p.with, { name: a.profiles?.full_name ?? "" })}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={a.status} />
                          </td>
                          <td className="py-3">{canEdit(a.staff_id) && <StatusForm id={a.id} status={a.status} who={name(a)} labels={p} statusNames={t.status} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">{p.none}</p>
            ))}
        </section>

        <div className="space-y-6 self-start">
          {selected && (
            <section aria-labelledby="appt-details" className="card border-accent">
              <div className="flex items-start justify-between gap-3">
                <h2 id="appt-details" className="text-lg font-semibold">
                  {p.details}
                </h2>
                <Link href={href({ appt: undefined })} aria-label={p.close} className="-m-2 flex size-10 items-center justify-center rounded-2xl hover:bg-canvas">
                  <X aria-hidden className="size-5" />
                </Link>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <dt className="sr-only">{p.client}</dt>
                <dd className="text-base font-semibold">{clientName(selected.clients, t.dashboard.unknownClient)}</dd>
                <dd className="text-muted">{selected.clients?.phone_number}</dd>
                <dt className="sr-only">{p.when}</dt>
                <dd>
                  <time dateTime={selected.appointment_time}>{formatInZone(selected.appointment_time, salon.timezone, { dateStyle: "full" }, intl)}</time>
                </dd>
                <dt className="sr-only">{p.service}</dt>
                <dd>
                  {selected.services?.name} · {fmt(p.with, { name: selected.profiles?.full_name ?? "" })}
                </dd>
                <dd className="pt-1">
                  <StatusBadge status={selected.status} />
                </dd>
              </dl>
              <Link href={`/dashboard/clients/${selected.client_id}`} className="mt-3 inline-block text-sm font-medium text-accent">
                {p.openClient}
              </Link>
              {canEdit(selected.staff_id) && (
                <>
                  <div className="mt-4">
                    <StatusForm id={selected.id} status={selected.status} who={clientName(selected.clients, t.dashboard.unknownClient)} labels={p} statusNames={t.status} withMessage />
                  </div>
                  {(selected.status === "pending" || selected.status === "confirmed") && (
                    <ActionForm action={rescheduleAppointment} resetOnSuccess={false} className="mt-5 space-y-3 border-t border-line pt-4" aria-label={p.reschedule}>
                      <h3 className="font-semibold">{p.reschedule}</h3>
                      <input type="hidden" name="id" value={selected.id} />
                      <input type="hidden" name="serviceId" value={selected.service_id} />
                      <input type="hidden" name="staffId" value={selected.staff_id} />
                      <SlotPicker
                        name="localTime"
                        defaultDate={toLocalInputValue(new Date(selected.appointment_time), salon.timezone).split("T")[0]}
                        minDate={todayIso}
                        labels={{ label: p.dateTime, date: p.date, pickService: p.pickServiceFirst, loading: p.loadingSlots, none: p.noSlots, failed: p.slotsFailed, slotsFor: p.freeTimes }}
                      />
                      <PendingButton className="btn-secondary w-full">{p.rescheduleButton}</PendingButton>
                    </ActionForm>
                  )}
                </>
              )}
            </section>
          )}

          <section id="book" aria-labelledby="book-title" className="card scroll-mt-6">
            <h2 id="book-title" className="text-lg font-semibold">
              {p.book}
            </h2>
            {(services.data ?? []).length > 0 ? (
              <ActionForm action={createAppointment} className="mt-4 space-y-4" aria-label={p.book}>
                <BookingClientFields
                  clients={knownClients.map(({ name, phone }) => ({ name, phone }))}
                  defaultName={preselected?.name}
                  defaultPhone={preselected?.phone}
                  nameLabel={p.clientNameOptional}
                  phoneLabel={t.dashboard.clients.phone}
                  hint={p.newClientHint}
                />
                <SelectField label={p.service} name="serviceId" required defaultValue="">
                  <option value="" disabled>
                    {p.chooseService}
                  </option>
                  {(services.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({fmt(p.minutes, { n: s.duration_minutes })})
                    </option>
                  ))}
                </SelectField>
                <BarberPicker
                  barbers={bookableStaff.map((s) => ({ id: s.id, name: s.full_name }))}
                  allowAny={isManager}
                  defaultValue={presetStaff ?? (isManager ? "" : userId)}
                  labels={{ label: isManager ? p.barberOptional : p.barber, any: p.anyBarber, anyHint: p.anyBarberHint, search: p.searchBarber, noMatch: p.noBarberMatch }}
                />
                <SlotPicker
                  key={`${bookDate}-${sp.time ?? ""}`}
                  name="localTime"
                  defaultDate={bookDate}
                  defaultTime={sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : ""}
                  minDate={todayIso}
                  hint={timeHint}
                  labels={{ label: p.dateTime, date: p.date, pickService: p.pickServiceFirst, loading: p.loadingSlots, none: p.noSlots, failed: p.slotsFailed, slotsFor: p.freeTimes }}
                />
                <PendingButton className="btn-primary w-full" pendingLabel={p.booking}>
                  {p.bookButton}
                </PendingButton>
              </ActionForm>
            ) : (
              <p className="mt-3 text-sm text-muted">{p.needData}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function isoParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

type Labels = Awaited<ReturnType<typeof getI18n>>["t"]["dashboard"]["appointments"];

function StatusForm({
  id,
  status,
  who,
  labels: p,
  statusNames,
  withMessage = false,
}: {
  id: string;
  status: AppointmentStatus;
  who: string;
  labels: Labels;
  statusNames: Record<AppointmentStatus, string>;
  withMessage?: boolean;
}) {
  return (
    <ActionForm action={updateAppointmentStatus} resetOnSuccess={false} showMessage={withMessage} className={withMessage ? "space-y-2" : "flex gap-2"} aria-label={p.updateStatus}>
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <label htmlFor={`st-${id}${withMessage ? "-d" : ""}`} className="sr-only">
          {fmt(p.newStatusFor, { name: who })}
        </label>
        <select id={`st-${id}${withMessage ? "-d" : ""}`} name="status" defaultValue={status} className="input w-auto py-1.5">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusNames[s]}
            </option>
          ))}
        </select>
        <PendingButton className="btn-secondary py-1.5" pendingLabel="…">
          {p.save}
        </PendingButton>
      </div>
    </ActionForm>
  );
}

type GridAppt = { id: string; staffId: string; start: Date; end: Date; status: AppointmentStatus; label: string; sub: string; href: string };

/** Day view: one column per barber, rows every 30 minutes within opening hours, a line at the current time. */
function DayGrid({
  date,
  isToday,
  now,
  timeZone,
  opensAt,
  closesAt,
  closed,
  barbers,
  bookable,
  appts,
  slotHref,
  labels: p,
}: {
  date: string;
  isToday: boolean;
  now: Date;
  timeZone: string;
  opensAt: string;
  closesAt: string;
  closed: boolean;
  barbers: { id: string; full_name: string }[];
  bookable: Set<string>;
  appts: GridAppt[];
  slotHref: (staffId: string, time: string) => string;
  labels: Labels;
}) {
  if (!barbers.length) return <p className="mt-4 text-sm text-muted">{p.noBarbers}</p>;
  const rows = dayRows(date, timeZone, opensAt, closesAt, ROW_MIN);
  if (closed || !rows.length) return <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-muted">{p.closedDay}</p>;
  const open = rows[0].start;
  const close = new Date(rows[rows.length - 1].start.getTime() + ROW_MIN * 60_000);
  const height = rows.length * ROW_PX;
  const nowPos = isToday && now >= open && now < close ? blockPosition(now, now, open, close).top : null;
  const tone: Record<AppointmentStatus, string> = {
    pending: "border-warn bg-warn-soft",
    confirmed: "border-accent bg-brand-soft",
    completed: "border-line bg-busy text-muted",
    no_show: "border-warn bg-warn-soft text-muted line-through",
    cancelled: "border-danger bg-danger-soft",
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `3.5rem repeat(${barbers.length}, minmax(10rem, 1fr))` }}>
        <div className="sticky left-0 z-20 border-b border-line bg-surface p-2 text-xs text-muted">{p.timeColumn}</div>
        {barbers.map((b) => (
          <div key={b.id} className="truncate border-b border-l border-line p-2 text-sm font-semibold">
            {b.full_name}
          </div>
        ))}

        <div className="sticky left-0 z-20 bg-surface" style={{ height }}>
          {rows.map((r) => (
            <div key={r.time} className="border-t border-line px-2 pt-0.5 text-xs tabular-nums text-muted first:border-t-0" style={{ height: ROW_PX }}>
              {r.time.endsWith(":00") ? r.time : ""}
            </div>
          ))}
        </div>
        {barbers.map((b) => (
          <div key={b.id} className="relative border-l border-line" style={{ height }}>
            {rows.map((r) => {
              const past = r.start < now;
              const free = !past && bookable.has(b.id);
              return free ? (
                <Link
                  key={r.time}
                  href={slotHref(b.id, r.time)}
                  aria-label={fmt(p.bookAt, { time: r.time, barber: b.full_name })}
                  className="block border-t border-line/60 first:border-t-0 hover:bg-brand-soft/60 focus-visible:bg-brand-soft"
                  style={{ height: ROW_PX }}
                />
              ) : (
                <div key={r.time} className={`border-t border-line/60 first:border-t-0 ${past ? "bg-canvas/60" : ""}`} style={{ height: ROW_PX }} />
              );
            })}
            {appts
              .filter((a) => a.staffId === b.id)
              .map((a) => {
                const pos = blockPosition(a.start, a.end, open, close);
                if (pos.height <= 0) return null;
                return (
                  <Link
                    key={a.id}
                    href={a.href}
                    className={`absolute inset-x-1 z-10 overflow-hidden rounded-xl border-l-4 px-2 py-1 text-xs shadow-soft hover:brightness-95 ${tone[a.status]}`}
                    style={{ top: `${pos.top}%`, height: `calc(${pos.height}% - 2px)` }}
                  >
                    <span className="block truncate font-semibold">{a.label}</span>
                    <span className="block truncate">{a.sub}</span>
                  </Link>
                );
              })}
            {nowPos !== null && <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: `${nowPos}%` }} />}
          </div>
        ))}
      </div>
      {nowPos !== null && <p className="sr-only">{`${p.now}: ${new Intl.DateTimeFormat("en-GB", { timeZone, timeStyle: "short" }).format(now)}`}</p>}
    </div>
  );
}
