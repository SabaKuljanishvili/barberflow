import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field, SelectField } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { requireUser } from "@/lib/auth";
import { clientName, money } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInZone } from "@/lib/time";
import { INTL_LOCALE, LOCALES, LOCALE_NAMES, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { deleteClient, updateClient } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.clients.profile };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { salon, isManager } = await requireUser();
  const { locale, t } = await getI18n();
  const p = t.dashboard.clients;
  const intl = INTL_LOCALE[locale];
  const supabase = await createSupabaseServerClient();

  const [client, appts, archived] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).eq("salon_id", salon.id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, appointment_time, status, services(name, price), profiles(full_name)")
      .eq("client_id", id)
      .order("appointment_time", { ascending: false })
      .limit(200),
    // Managers can read the archive (RLS); for barbers this comes back empty.
    supabase
      .from("appointments_archive")
      .select("id, appointment_time, status, price")
      .eq("client_id", id)
      .order("appointment_time", { ascending: false })
      .limit(200),
  ]);
  if (!client.data) notFound();
  const c = client.data;
  const name = clientName(c, t.dashboard.unknownClient, t.dashboard.unnamedClient);

  const now = new Date().getTime();
  const rows = appts.data ?? [];
  const upcoming = rows
    .filter((a) => new Date(a.appointment_time).getTime() >= now && (a.status === "pending" || a.status === "confirmed"))
    .reverse();
  const past = rows.filter((a) => new Date(a.appointment_time).getTime() < now);
  const arch = archived.data ?? [];
  const done = past.filter((a) => a.status === "completed");
  const archDone = arch.filter((a) => a.status === "completed");
  const visits = done.length + archDone.length;
  const spend = done.reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0) + archDone.reduce((sum, a) => sum + Number(a.price ?? 0), 0);
  const noShows = past.filter((a) => a.status === "no_show").length + arch.filter((a) => a.status === "no_show").length;
  const when = (iso: string) => formatInZone(iso, salon.timezone, {}, intl);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        structured={false}
        items={[
          { href: "/dashboard", label: t.dashboard.nav.overview },
          { href: "/dashboard/clients", label: p.title },
          { href: `/dashboard/clients/${c.id}`, label: name },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">{c.phone_number}</p>
        </div>
        <Link href={`/dashboard/appointments?client=${c.id}#book`} className="btn-primary inline-flex items-center gap-2">
          <CalendarPlus aria-hidden className="size-4" />
          {p.bookAgain}
        </Link>
      </div>

      <section aria-label={p.totals} className="grid gap-4 sm:grid-cols-3">
        {[
          [p.totalVisits, String(visits)],
          [p.totalSpend, money(spend)],
          [p.totalNoShows, String(noShows)],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section aria-labelledby="upcoming" className="card">
            <h2 id="upcoming" className="text-lg font-semibold">
              {p.upcomingTitle}
            </h2>
            {upcoming.length ? (
              <ul className="mt-3 divide-y divide-line">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <Link href={`/dashboard/appointments?appt=${a.id}`} className="min-w-0 hover:text-accent">
                      <span className="font-medium">{when(a.appointment_time)}</span>
                      <span className="block text-sm text-muted">
                        {a.services?.name} · {a.profiles?.full_name}
                      </span>
                    </Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{p.noUpcoming}</p>
            )}
          </section>

          <section aria-labelledby="history" className="card">
            <h2 id="history" className="text-lg font-semibold">
              {p.historyTitle}
            </h2>
            {past.length || arch.length ? (
              <ul className="mt-3 divide-y divide-line">
                {past.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{when(a.appointment_time)}</p>
                      <p className="text-sm text-muted">
                        {a.services?.name} · {a.profiles?.full_name}
                        {a.status === "completed" && a.services ? ` · ${money(a.services.price)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
                {arch.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-muted">
                    <p>
                      {when(a.appointment_time)}
                      {a.status === "completed" && a.price !== null ? ` · ${money(a.price)}` : ""}
                    </p>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{p.noHistory}</p>
            )}
          </section>
        </div>

        <div className="space-y-6 self-start">
          <section aria-labelledby="details" className="card">
            <h2 id="details" className="text-lg font-semibold">
              {p.details}
            </h2>
            <ActionForm action={updateClient} resetOnSuccess={false} className="mt-4 space-y-4" aria-label={p.details}>
              <input type="hidden" name="id" value={c.id} />
              <Field label={p.firstName} name="firstName" maxLength={60} defaultValue={c.first_name} autoComplete="off" />
              <Field label={p.lastName} name="lastName" maxLength={60} defaultValue={c.last_name} autoComplete="off" />
              <PhoneField label={p.phone} name="phoneNumber" required defaultValue={c.phone_number} autoComplete="off" />
              <SelectField label={p.language} name="locale" defaultValue={c.locale ?? ""}>
                <option value="">{p.languageDefault}</option>
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </SelectField>
              <div>
                <label htmlFor="notes" className="label">
                  {p.notes}
                </label>
                <textarea id="notes" name="notes" rows={4} maxLength={2000} defaultValue={c.notes} aria-describedby="notes-hint" className="input" />
                <p id="notes-hint" className="mt-1 text-xs text-muted">
                  {p.notesHint}
                </p>
              </div>
              <PendingButton className="btn-primary w-full">{p.save}</PendingButton>
            </ActionForm>
          </section>

          {isManager && (
            <section aria-labelledby="delete" className="card border-danger/40">
              <h2 id="delete" className="text-lg font-semibold text-danger">
                {p.deleteTitle}
              </h2>
              <p className="mt-1 text-sm text-muted">{p.deleteBody}</p>
              <ActionForm action={deleteClient} resetOnSuccess={false} className="mt-4 space-y-3" aria-label={p.deleteTitle}>
                <input type="hidden" name="id" value={c.id} />
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="confirm" required className="mt-0.5 size-4 accent-brand" />
                  {fmt(p.deleteConfirm, { name })}
                </label>
                <PendingButton className="btn-secondary w-full border-danger text-danger">{p.deleteButton}</PendingButton>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
