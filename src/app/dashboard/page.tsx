import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Banknote, PhoneIncoming, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { clientName, money } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInZone, zonedDayBounds } from "@/lib/time";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.nav.overview };
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { salon, profile } = await requireUser();
  const { locale, t } = await getI18n();
  const o = t.dashboard.overview;
  const intl = INTL_LOCALE[locale];
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const today = zonedDayBounds(now, salon.timezone);
  const weekStart = new Date(today.start.getTime() - 6 * 86_400_000);
  const monthStart = new Date(today.start.getTime() - 29 * 86_400_000);

  const [todayAppts, week, newClients, calls] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, appointment_time, status, staff_id, clients(first_name, last_name, phone_number), services(name), profiles(full_name)")
      .gte("appointment_time", today.start.toISOString())
      .lt("appointment_time", today.end.toISOString())
      .neq("status", "cancelled")
      .order("appointment_time"),
    supabase
      .from("appointments")
      .select("status, staff_id, services(price), profiles(full_name)")
      .gte("appointment_time", weekStart.toISOString())
      .lt("appointment_time", today.end.toISOString())
      .neq("status", "cancelled"),
    supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("call_logs").select("outcome").gte("created_at", weekStart.toISOString()),
  ]);

  const todayList = todayAppts.data ?? [];
  const weekRows = week.data ?? [];
  const revenue = weekRows.filter((r) => r.status === "completed").reduce((sum, r) => sum + Number(r.services?.price ?? 0), 0);
  const callRows = calls.data ?? [];
  const booked = callRows.filter((c) => c.outcome === "booked").length;

  const perBarber = new Map<string, { name: string; count: number }>();
  for (const r of weekRows) {
    const entry = perBarber.get(r.staff_id) ?? { name: r.profiles?.full_name ?? o.barberFallback, count: 0 };
    entry.count++;
    perBarber.set(r.staff_id, entry);
  }
  const barbers = [...perBarber.values()].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...barbers.map((b) => b.count));

  return (
    <div className="space-y-6">
      {error === "forbidden" && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {o.forbidden}
        </p>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fmt(o.greeting, { name: profile.full_name.split(" ")[0] })}</h1>
        <p className="mt-1 text-muted">
          {fmt(o.dateAt, { date: formatInZone(now, salon.timezone, { dateStyle: "full", timeStyle: undefined }, intl), salon: salon.name })}
        </p>
      </div>

      <section aria-label={o.keyNumbers} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          highlight
          icon={CalendarDays}
          label={o.apptsToday}
          value={String(todayList.length)}
          note={fmt(o.awaitingCount, { count: todayList.filter((a) => a.status === "pending").length })}
        />
        <Stat icon={Banknote} label={o.revenue} value={money(revenue)} note={o.revenueNote} />
        <Stat
          icon={PhoneIncoming}
          label={o.calls}
          value={String(callRows.length)}
          note={fmt(o.callsNote, { count: booked })}
        />
        <Stat icon={UserPlus} label={o.newClients} value={String(newClients.count ?? 0)} note={o.newClientsNote} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="today" className="card xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 id="today" className="text-lg font-semibold">
              {o.schedule}
            </h2>
            <Link href="/dashboard/appointments" className="text-sm font-medium text-accent hover:text-accent">
              {o.allAppointments}
            </Link>
          </div>
          {todayList.length ? (
            <ul className="mt-4 divide-y divide-line">
              {todayList.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <time dateTime={a.appointment_time} className="w-20 text-sm font-semibold tabular-nums">
                    {formatInZone(a.appointment_time, salon.timezone, { dateStyle: undefined, timeStyle: "short" }, intl)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{clientName(a.clients, t.dashboard.unknownClient)}</p>
                    <p className="truncate text-sm text-muted">
                      {fmt(o.serviceWith, { service: a.services?.name ?? "", barber: a.profiles?.full_name ?? "" })}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{o.noneToday}</p>
          )}
        </section>

        <section aria-labelledby="by-barber" className="card">
          <h2 id="by-barber" className="text-lg font-semibold">
            {o.byBarber}
          </h2>
          <p className="text-sm text-muted">{o.byBarberNote}</p>
          {barbers.length ? (
            <ul className="mt-5 space-y-4">
              {barbers.map((b) => (
                <li key={b.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="tabular-nums text-muted">{b.count}</span>
                  </div>
                  <div
                    className="mt-1.5 h-2 rounded-full bg-canvas"
                    role="img"
                    aria-label={fmt(o.barberBookings, { name: b.name, count: b.count })}
                    title={fmt(o.barberBookings, { name: b.name, count: b.count })}
                  >
                    <div className="h-2 rounded-full bg-brand" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{o.noneWeek}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-3xl bg-brand p-6 text-on-brand shadow-soft" : "card"}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-medium ${highlight ? "text-on-brand/90" : "text-muted"}`}>{label}</p>
        <span
          className={`inline-flex size-9 items-center justify-center rounded-2xl ${highlight ? "bg-on-brand/10 text-on-brand/90" : "bg-brand-soft text-accent"}`}
        >
          <Icon aria-hidden className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-sm ${highlight ? "text-on-brand/90" : "text-muted"}`}>{note}</p>
    </div>
  );
}
