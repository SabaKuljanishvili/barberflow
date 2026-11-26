import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Board, NewBookingButton } from "@/components/dashboard/appointments/board";
import { ListView } from "@/components/dashboard/appointments/list-view";
import { StatusFilter } from "@/components/dashboard/appointments/status-filter";
import { DayView, WeekView, type WeekDay } from "@/components/dashboard/appointments/time-grid";
import { colorVar, type ApptVM, type BarberVM } from "@/components/dashboard/appointments/types";
import { requireUser } from "@/lib/auth";
import { LIST_PAGE, STATUSES, VIEWS, barberColors, initials, listLimit, resolveView, type DayNames, type Prefill, type View } from "@/lib/appointments-ui";
import { isIsoDate, isoWeekday, shiftDate, weekDates } from "@/lib/calendar";
import { clientName } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInZone, toLocalInputValue, zonedParts, zonedToUtc } from "@/lib/time";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.appointments.title };
}

type Sp = { view?: string; date?: string; barber?: string; status?: string; range?: string; limit?: string; client?: string; appt?: string };

const SELECT = "id, appointment_time, ends_at, status, source, staff_id, client_id, service_id, clients(first_name, last_name, phone_number), services(name, duration_minutes), profiles(full_name)";

const pad = (n: number) => String(n).padStart(2, "0");

function isoParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const { salon, userId, isManager } = await requireUser();
  const { locale, t } = await getI18n();
  const p = t.dashboard.appointments;
  const intl = INTL_LOCALE[locale];
  const sp = await searchParams;
  const h = await headers();
  const mobile = h.get("sec-ch-ua-mobile") === "?1" || /Mobi|Android|iPhone|iPod/i.test(h.get("user-agent") ?? "");
  const view: View = resolveView(sp, mobile);
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;
  const range = sp.range === "past" ? "past" : "upcoming";
  const limit = listLimit(sp.limit);
  const tz = salon.timezone;

  const now = new Date();
  const todayIso = toLocalInputValue(now, tz).split("T")[0];
  const date = isIsoDate(sp.date) ? sp.date : todayIso;
  const week = weekDates(date);
  const thisWeek = weekDates(todayIso);
  const dayStart = (iso: string) => zonedToUtc(...isoParts(iso), 0, 0, tz);
  const windowStart = dayStart(view === "week" ? week[0] : date);
  const windowEnd = dayStart(shiftDate(view === "week" ? week[6] : date, 1));
  const startOfToday = dayStart(todayIso);
  const supabase = await createSupabaseServerClient();

  // Header stats: the whole shop for a manager, only their own chair for a barber.
  const count = () => {
    const q = supabase.from("appointments").select("id", { count: "exact", head: true });
    return isManager ? q : q.eq("staff_id", userId);
  };

  let listQuery = supabase.from("appointments").select(SELECT).limit(limit + 1);
  listQuery =
    range === "past"
      ? listQuery.lt("appointment_time", startOfToday.toISOString()).order("appointment_time", { ascending: false })
      : listQuery.gte("appointment_time", startOfToday.toISOString()).order("appointment_time");
  if (status) listQuery = listQuery.eq("status", status);
  const calendarQuery = supabase
    .from("appointments")
    .select(SELECT)
    .neq("status", "cancelled")
    .gte("ends_at", windowStart.toISOString())
    .lt("appointment_time", windowEnd.toISOString())
    .order("appointment_time");

  const [teamRes, appts, clients, services, detail, statToday, statWeek, statPending] = await Promise.all([
    supabase.from("profiles").select("id, full_name, active, takes_clients").order("role").order("full_name"),
    view === "list" ? listQuery : calendarQuery,
    supabase.from("clients").select("id, first_name, last_name, phone_number").order("first_name").limit(500),
    supabase.from("services").select("id, name, duration_minutes, price").eq("active", true).order("sort_order").order("name"),
    sp.appt ? supabase.from("appointments").select(SELECT).eq("id", sp.appt).maybeSingle() : Promise.resolve({ data: null }),
    count().neq("status", "cancelled").gte("appointment_time", startOfToday.toISOString()).lt("appointment_time", dayStart(shiftDate(todayIso, 1)).toISOString()),
    count().neq("status", "cancelled").gte("appointment_time", dayStart(thisWeek[0]).toISOString()).lt("appointment_time", dayStart(shiftDate(thisWeek[6], 1)).toISOString()),
    count().eq("status", "pending").gte("appointment_time", now.toISOString()),
  ]);

  // Team order (role, then name) is the Team page's order and fixes each barber's colour.
  const team = teamRes.data ?? [];
  const colors = barberColors(team.map((m) => m.id));
  const bookable = team.filter((m) => m.active && m.takes_clients);
  // Barbers see the whole shop calendar but cannot filter; the chips are a manager tool.
  const barberFilter = isManager && bookable.some((b) => b.id === sp.barber) ? sp.barber : undefined;

  type Row = NonNullable<typeof detail.data>;
  const toVM = (a: Row): ApptVM => {
    const s = zonedParts(new Date(a.appointment_time), tz);
    const e = zonedParts(new Date(a.ends_at), tz);
    const iso = `${s.year}-${pad(s.month)}-${pad(s.day)}`;
    const sameDay = e.year === s.year && e.month === s.month && e.day === s.day;
    const duration = a.services?.duration_minutes ?? Math.round((Date.parse(a.ends_at) - Date.parse(a.appointment_time)) / 60_000);
    return {
      id: a.id,
      staffId: a.staff_id,
      clientId: a.client_id,
      serviceId: a.service_id,
      date: iso,
      time: `${pad(s.hour)}:${pad(s.minute)}`,
      startMin: s.hour * 60 + s.minute,
      endMin: sameDay ? e.hour * 60 + e.minute : 24 * 60,
      duration,
      client: clientName(a.clients, t.dashboard.unknownClient),
      phone: a.clients?.phone_number ?? "",
      service: a.services?.name ?? "",
      barber: a.profiles?.full_name ?? "",
      color: colors.get(a.staff_id) ?? "mint",
      status: a.status,
      source: a.source,
      when: formatInZone(a.appointment_time, tz, { dateStyle: "full" }, intl),
      canEdit: isManager || a.staff_id === userId,
    };
  };

  const fetched = (appts.data ?? []) as Row[];
  const hasMore = view === "list" && fetched.length > limit;
  const rows = (hasMore ? fetched.slice(0, limit) : fetched).filter((a) => view === "list" || !barberFilter || a.staff_id === barberFilter).map(toVM);
  const nowParts = zonedParts(now, tz);
  const nowMin = nowParts.hour * 60 + nowParts.minute;
  const hours = { opensAt: salon.opens_at.slice(0, 5), closesAt: salon.closes_at.slice(0, 5), workingDays: salon.working_days, closedDates: salon.closed_dates ?? [] };
  const isClosed = (iso: string) => !hours.workingDays.includes(isoWeekday(iso)) || hours.closedDates.includes(iso);

  const toBarber = (m: (typeof team)[number]): BarberVM => ({
    id: m.id,
    name: m.full_name,
    initials: initials(m.full_name),
    color: colors.get(m.id) ?? "mint",
    count: rows.filter((r) => r.staffId === m.id && r.date === date).length,
  });
  const barbers = bookable.map(toBarber);
  const columns = barberFilter ? barbers.filter((b) => b.id === barberFilter) : barbers;
  const bookingBarbers = isManager ? barbers : barbers.filter((b) => b.id === userId);

  const knownClients = (clients.data ?? []).filter((c) => c.first_name).map((c) => ({ id: c.id, name: clientName(c, ""), phone: c.phone_number ?? "" }));
  const preselected = sp.client ? knownClients.find((c) => c.id === sp.client) : undefined;
  const initialBooking: Prefill | null = preselected ? { phone: preselected.phone, name: preselected.name } : null;

  const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));
  // Client components cannot format Georgian dates (Chrome ships no "ka" ICU data); they get the names.
  const monthOf = new Intl.DateTimeFormat(intl, { timeZone: "UTC", day: "numeric", month: "long" });
  const dayNames: DayNames = {
    weekdayShort: thisWeek.map((iso) => dayLabel(iso, { weekday: "short" })),
    weekdayLong: thisWeek.map((iso) => dayLabel(iso, { weekday: "long" })),
    months: Array.from({ length: 12 }, (_, i) => monthOf.formatToParts(new Date(Date.UTC(2026, i, 15))).find((x) => x.type === "month")?.value ?? ""),
    monthFirst: locale === "en",
  };
  const longDay = (iso: string) => dayLabel(iso, { weekday: "long", day: "numeric", month: "long" });
  const sameMonth = week[0].slice(0, 7) === week[6].slice(0, 7);
  const title =
    view === "list"
      ? range === "past"
        ? p.past
        : p.upcoming
      : view === "week"
        ? `${dayLabel(week[0], sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} – ${dayLabel(week[6], { day: "numeric", month: "long" })}`
        : longDay(date);

  // Links keep the view explicit (so the phone default never overrides a choice) and only the keys that view uses.
  const href = (q: Partial<Sp> & { view?: View }) => {
    const v = q.view ?? view;
    const params = new URLSearchParams({ view: v });
    if (v === "list") {
      const r = q.range ?? range;
      const s = "status" in q ? q.status : status;
      if (r === "past") params.set("range", r);
      if (s) params.set("status", s);
      if (q.limit) params.set("limit", q.limit);
    } else {
      params.set("date", q.date ?? date);
      const b = "barber" in q ? q.barber : barberFilter;
      if (b) params.set("barber", b);
    }
    return `/dashboard/appointments?${params}`;
  };

  const weekDays: WeekDay[] = week.map((iso) => ({
    iso,
    weekday: dayLabel(iso, { weekday: "short" }),
    num: dayLabel(iso, { day: "numeric" }),
    closed: isClosed(iso),
    label: longDay(iso),
  }));
  const dayHref = Object.fromEntries(week.map((iso) => [iso, href({ view: "day", date: iso })]));
  const dateTitles = Object.fromEntries(rows.map((r) => [r.date, r.date === todayIso ? fmt(p.todayTitle, { date: longDay(r.date) }) : longDay(r.date)]));
  const step = view === "week" ? 7 : 1;
  const viewName: Record<View, string> = { day: p.viewDay, week: p.viewWeek, list: p.viewList };

  const chip = "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs";
  const chipOn = `${chip} bg-ap-ink font-bold text-ap-bg`;
  const chipOff = `${chip} border border-ap-chip-line font-semibold text-ap-ink2 hover:border-ap-sel-line`;
  const navBtn = "flex size-10 items-center justify-center rounded-[10px] border border-ap-line2 bg-ap-bg text-ap-ink hover:border-ap-chip-line";

  return (
    <Board
      rows={rows}
      detail={detail.data ? toVM(detail.data as Row) : null}
      booking={{ services: (services.data ?? []).map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes, price: String(Number(s.price)) })), barbers: bookingBarbers, clients: knownClients, hours, todayIso, dayNames, isManager, userId }}
      initialBooking={initialBooking}
      labels={p}
      names={t.status}
    >
      <div className="flex flex-col gap-[18px] text-ap-ink lg:h-[calc(100dvh-146px)] lg:min-h-[560px]">
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1">
            <nav aria-label={t.nav.breadcrumb}>
              <ol className="flex items-center gap-1 text-xs text-ap-muted">
                <li>
                  <Link href="/dashboard" className="hover:text-accent">
                    {t.dashboard.nav.overview}
                  </Link>
                </li>
                <li aria-hidden>›</li>
                <li aria-current="page" className="font-bold text-ap-ink">
                  {p.title}
                </li>
              </ol>
            </nav>
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.01em]">{p.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <dl aria-label={p.stats} className="flex gap-3.5 text-[13px] text-ap-muted">
              <div className="flex gap-1">
                <dt>{p.statToday}</dt>
                <dd className="font-bold text-ap-ink">{statToday.count ?? 0}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{p.statWeek}</dt>
                <dd className="font-bold text-ap-ink">{statWeek.count ?? 0}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{p.statPending}</dt>
                <dd className="font-bold text-ap-pending">{statPending.count ?? 0}</dd>
              </div>
            </dl>
            <NewBookingButton />
          </div>
        </div>

        <section
          aria-labelledby="cal-title"
          className="flex flex-col gap-3.5 rounded-[22px] border border-ap-line bg-ap-card p-3 [--ap-day-min:104px] sm:p-4 lg:min-h-0 lg:flex-1 lg:[--ap-day-min:0px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <div role="tablist" aria-label={p.views} className="flex rounded-xl border border-ap-line2 bg-ap-bg p-1">
                {VIEWS.map((v) => (
                  <Link
                    key={v}
                    id={`tab-${v}`}
                    role="tab"
                    aria-selected={v === view}
                    aria-controls="cal-panel"
                    href={href({ view: v })}
                    scroll={false}
                    className={`flex h-10 items-center rounded-[9px] px-3.5 text-[13px] ${v === view ? "bg-brand font-bold text-ap-on-green" : "font-semibold text-ap-muted hover:text-ap-ink"}`}
                  >
                    {viewName[v]}
                  </Link>
                ))}
              </div>
              <h2 id="cal-title" className="text-lg font-extrabold">
                {title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view !== "list" && isManager && barbers.length > 1 && (
                <ul aria-label={p.barberFilter} className="mr-1.5 flex gap-1.5 max-md:-mx-1 max-md:w-full max-md:overflow-x-auto max-md:px-1 md:flex-wrap">
                  <li>
                    <Link href={href({ barber: undefined })} scroll={false} aria-current={!barberFilter ? "true" : undefined} className={!barberFilter ? chipOn : chipOff}>
                      {p.allBarbers}
                    </Link>
                  </li>
                  {barbers.map((b) => (
                    <li key={b.id}>
                      <Link href={href({ barber: b.id })} scroll={false} aria-current={barberFilter === b.id ? "true" : undefined} className={barberFilter === b.id ? chipOn : chipOff}>
                        <span aria-hidden className="size-[7px] rounded-full" style={{ background: colorVar(b.color) }} />
                        {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {view === "list" && (
                <div className="mr-1.5 flex flex-wrap gap-1.5">
                  <Link href={href({ range: "upcoming" })} scroll={false} aria-current={range === "upcoming" ? "true" : undefined} className={range === "upcoming" ? chipOn : chipOff}>
                    {p.rangeUpcoming}
                  </Link>
                  <Link href={href({ range: "past" })} scroll={false} aria-current={range === "past" ? "true" : undefined} className={range === "past" ? chipOn : chipOff}>
                    {p.rangePast}
                  </Link>
                  <StatusFilter
                    label={p.status}
                    value={status ?? ""}
                    options={[{ value: "", label: p.allStatuses, href: href({ status: undefined }) }, ...STATUSES.map((s) => ({ value: s, label: t.status[s], href: href({ status: s }) }))]}
                  />
                </div>
              )}
              {view !== "list" && (
                <div className="flex items-center gap-2">
                  <Link href={href({ date: shiftDate(date, -step) })} scroll={false} aria-label={view === "week" ? p.prevWeek : p.prevDay} className={navBtn}>
                    <ChevronLeft aria-hidden className="size-4" />
                  </Link>
                  <Link href={href({ date: todayIso })} scroll={false} className="flex h-10 items-center rounded-[10px] border border-ap-line2 bg-ap-bg px-3 text-[13px] font-semibold hover:border-ap-chip-line">
                    {p.today}
                  </Link>
                  <Link href={href({ date: shiftDate(date, step) })} scroll={false} aria-label={view === "week" ? p.nextWeek : p.nextDay} className={navBtn}>
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div id="cal-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className="flex flex-col lg:min-h-0 lg:flex-1">
            {view === "day" && (
              <DayView
                date={date}
                todayIso={todayIso}
                closed={isClosed(date)}
                barbers={columns}
                bookableIds={(isManager ? barbers : bookingBarbers).map((b) => b.id)}
                appts={rows}
                hours={hours}
                nowMin={nowMin}
                timeZone={tz}
              />
            )}
            {view === "week" && <WeekView days={weekDays} todayIso={todayIso} appts={rows} hours={hours} nowMin={nowMin} timeZone={tz} dayHref={dayHref} />}
            {view === "list" && <ListView rows={rows} todayIso={todayIso} dateTitles={dateTitles} moreHref={hasMore ? href({ limit: String(limit + LIST_PAGE) }) : null} />}
          </div>
        </section>
      </div>
    </Board>
  );
}
