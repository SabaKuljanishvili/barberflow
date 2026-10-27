import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BookingClientFields } from "@/components/dashboard/booking-client-fields";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/field";
import { DateTimeField } from "@/components/ui/time-field";
import { requireUser } from "@/lib/auth";
import { clientName } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bookableHours, findOpenSlots, formatInZone, timeZoneLabel, toLocalInputValue, zonedDayBounds } from "@/lib/time";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { createAppointment, updateAppointmentStatus } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.appointments.title };
}

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; range?: string; client?: string }>;
}) {
  const { salon, userId, isManager } = await requireUser();
  const { locale, t } = await getI18n();
  const p = t.dashboard.appointments;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;
  const range = sp.range === "past" ? "past" : "upcoming";

  const supabase = await createSupabaseServerClient();
  const startOfToday = zonedDayBounds(new Date(), salon.timezone).start.toISOString();

  let query = supabase
    .from("appointments")
    .select("id, appointment_time, status, source, staff_id, clients(first_name, last_name, phone_number), services(name, duration_minutes), profiles(full_name)")
    .limit(100);
  query = range === "past" ? query.lt("appointment_time", startOfToday).order("appointment_time", { ascending: false }) : query.gte("appointment_time", startOfToday).order("appointment_time");
  if (status) query = query.eq("status", status);

  const [appts, clients, staff, services] = await Promise.all([
    query,
    supabase.from("clients").select("id, first_name, last_name, phone_number").order("first_name").limit(500),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("services").select("id, name, duration_minutes").order("name"),
  ]);

  const rows = appts.data ?? [];
  const bookableStaff = (staff.data ?? []).filter((s) => isManager || s.id === userId);
  const knownClients = (clients.data ?? [])
    .filter((c) => c.first_name)
    .map((c) => ({ id: c.id, name: clientName(c, ""), phone: c.phone_number ?? "" }));
  // "Book" on the Clients page links here with ?client=<id>.
  const preselected = knownClients.find((c) => c.id === sp.client);

  // Default to the next quarter hour the shop is open, in salon time.
  const now = new Date();
  const hours = { opensAt: salon.opens_at, closesAt: salon.closes_at, workingDays: salon.working_days };
  const [firstOpen] = findOpenSlots({ ...hours, from: now, timeZone: salon.timezone, durationMinutes: 15, busy: [], count: 1, stepMinutes: 15, leadMinutes: 0 });
  const nextSlot = firstOpen ?? new Date(Math.ceil(now.getTime() / 900_000) * 900_000);
  const { minHour, maxHour } = bookableHours(hours);
  const timeHint = fmt(p.shopTime, {
    zone: timeZoneLabel(salon.timezone, t.dashboard.tbilisi),
    now: formatInZone(now, salon.timezone, { dateStyle: undefined }, INTL_LOCALE[locale]),
    opens: salon.opens_at.slice(0, 5),
    closes: salon.closes_at.slice(0, 5),
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/appointments", label: p.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{p.intro}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="list" className="card xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="list" className="text-lg font-semibold">
              {range === "past" ? p.past : p.upcoming}
            </h2>
            <form method="get" className="flex flex-wrap items-end gap-2" aria-label={p.filter}>
              <div>
                <label htmlFor="range" className="sr-only">
                  {p.range}
                </label>
                <select id="range" name="range" defaultValue={range} className="input w-auto">
                  <option value="upcoming">{p.rangeUpcoming}</option>
                  <option value="past">{p.rangePast}</option>
                </select>
              </div>
              <div>
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
              </div>
              <button type="submit" className="btn-secondary">
                {p.apply}
              </button>
            </form>
          </div>

          {rows.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
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
                  {rows.map((a) => {
                    const canEdit = isManager || a.staff_id === userId;
                    return (
                      <tr key={a.id} className="border-b border-line align-top last:border-0">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <time dateTime={a.appointment_time}>{formatInZone(a.appointment_time, salon.timezone, {}, INTL_LOCALE[locale])}</time>
                          {a.source === "voice" && <span className="block text-xs text-brand-700">{p.byPhone}</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-medium">{clientName(a.clients, t.dashboard.unknownClient)}</span>
                          <span className="block text-xs text-muted">{a.clients?.phone_number}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {a.services?.name}
                          <span className="block text-xs text-muted">{fmt(p.with, { name: a.profiles?.full_name ?? "" })}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="py-3">
                          {canEdit && (
                            <ActionForm action={updateAppointmentStatus} resetOnSuccess={false} showMessage={false} className="flex gap-2" aria-label={p.updateStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <label htmlFor={`st-${a.id}`} className="sr-only">
                                {fmt(p.newStatusFor, { name: clientName(a.clients, t.dashboard.unknownClient) })}
                              </label>
                              <select id={`st-${a.id}`} name="status" defaultValue={a.status} className="input w-auto py-1.5">
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {t.status[s]}
                                  </option>
                                ))}
                              </select>
                              <PendingButton className="btn-secondary py-1.5" pendingLabel="…">
                                {p.save}
                              </PendingButton>
                            </ActionForm>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{p.none}</p>
          )}
        </section>

        <section aria-labelledby="book" className="card self-start">
          <h2 id="book" className="text-lg font-semibold">
            {p.book}
          </h2>
          {(services.data ?? []).length > 0 ? (
            <ActionForm action={createAppointment} className="mt-4 space-y-4" aria-label={p.book}>
              <BookingClientFields
                clients={knownClients.map(({ name, phone }) => ({ name, phone }))}
                defaultName={preselected?.name}
                defaultPhone={preselected?.phone}
                nameLabel={p.clientName}
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
              <SelectField label={p.barber} name="staffId" required defaultValue={isManager ? "" : userId}>
                {isManager && (
                  <option value="" disabled>
                    {p.chooseBarber}
                  </option>
                )}
                {bookableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </SelectField>
              <DateTimeField
                label={p.dateTime}
                dateLabel={p.date}
                name="localTime"
                defaultValue={toLocalInputValue(nextSlot, salon.timezone)}
                min={toLocalInputValue(now, salon.timezone)}
                minHour={minHour}
                maxHour={maxHour}
                hint={timeHint}
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
  );
}
