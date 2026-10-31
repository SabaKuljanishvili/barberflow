import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { requireUser } from "@/lib/auth";
import { clientName } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInZone } from "@/lib/time";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { createClient } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.clients.title };
}

/** Keeps only characters that are safe inside a PostgREST or() filter. */
function searchTerm(raw: string | undefined): string {
  return (raw ?? "").replace(/[^\p{L}\p{N}\s+'-]/gu, "").trim().slice(0, 60);
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { salon } = await requireUser();
  const { locale, t } = await getI18n();
  const p = t.dashboard.clients;
  const q = searchTerm((await searchParams).q);
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("clients").select("*, appointments(appointment_time, status)").order("created_at", { ascending: false }).limit(100);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},phone_number.ilike.${like}`);
  }
  const { data: clients } = await query;
  const now = new Date().getTime();
  const day = (iso: string) => formatInZone(iso, salon.timezone, { timeStyle: undefined }, INTL_LOCALE[locale]);

  /** Visit count (cancellations excluded), last past visit and next upcoming one. */
  function history(appts: { appointment_time: string; status: string }[]) {
    const kept = appts.filter((a) => a.status !== "cancelled").map((a) => a.appointment_time).sort();
    const past = kept.filter((iso) => new Date(iso).getTime() < now);
    return { visits: past.length, last: past.at(-1), next: kept.find((iso) => new Date(iso).getTime() >= now) };
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/clients", label: p.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{p.intro}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="list" className="card xl:col-span-2">
          <h2 id="list" className="text-lg font-semibold">
            {q ? fmt(p.results, { q }) : p.recent}
          </h2>
          {clients?.length ? (
            <ul className="mt-4 divide-y divide-line">
              {clients.map((c) => {
                const h = history(c.appointments ?? []);
                const name = clientName(c, t.dashboard.unknownClient);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted">{c.phone_number}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{fmt(p.visits, { n: h.visits })}</span>
                      {h.last && <span>{fmt(p.lastVisit, { date: day(h.last) })}</span>}
                      {h.next ? (
                        <span className="font-medium text-accent">{fmt(p.nextVisit, { date: day(h.next) })}</span>
                      ) : (
                        <span>{fmt(p.added, { date: day(c.created_at) })}</span>
                      )}
                      <Link
                        href={`/dashboard/appointments?client=${c.id}#book`}
                        className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-xs"
                        aria-label={fmt(p.bookFor, { name })}
                      >
                        <CalendarPlus aria-hidden className="size-4" />
                        {p.book}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{q ? p.noMatch : p.empty}</p>
          )}
        </section>

        <section aria-labelledby="add" className="card self-start">
          <h2 id="add" className="text-lg font-semibold">
            {p.add}
          </h2>
          <ActionForm action={createClient} className="mt-4 space-y-4" aria-label={p.add}>
            <Field label={p.firstName} name="firstName" autoComplete="off" required maxLength={60} />
            <Field label={p.lastName} name="lastName" autoComplete="off" maxLength={60} />
            <PhoneField label={p.phone} name="phoneNumber" autoComplete="off" required />
            <PendingButton className="btn-primary w-full">{p.addButton}</PendingButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
