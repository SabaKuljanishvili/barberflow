import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { requireManager } from "@/lib/auth";
import { money } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { createService, deleteService } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.services.title };
}

export default async function ServicesPage() {
  await requireManager();
  const { t } = await getI18n();
  const p = t.dashboard.services;
  const supabase = await createSupabaseServerClient();
  const { data: services } = await supabase.from("services").select("*").order("name");

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/services", label: p.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
        <p className="mt-1 text-muted">{p.intro}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="list" className="card xl:col-span-2">
          <h2 id="list" className="text-lg font-semibold">
            {p.menu}
          </h2>
          {services?.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted">{fmt(p.minutes, { n: s.duration_minutes })}</p>
                    </div>
                    <p className="text-lg font-bold text-accent tabular-nums">{money(s.price)}</p>
                  </div>
                  <ActionForm action={deleteService} resetOnSuccess={false} className="mt-3 space-y-2" aria-label={fmt(p.removeLabel, { name: s.name })}>
                    <input type="hidden" name="id" value={s.id} />
                    <PendingButton className="btn-danger py-1.5" pendingLabel={p.removing}>
                      {p.remove}<span className="sr-only"> {s.name}</span>
                    </PendingButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{p.empty}</p>
          )}
        </section>

        <section aria-labelledby="add" className="card self-start">
          <h2 id="add" className="text-lg font-semibold">
            {p.add}
          </h2>
          <ActionForm action={createService} className="mt-4 space-y-4" aria-label={p.add}>
            <Field label={p.name} name="name" required maxLength={80} placeholder={p.namePlaceholder} />
            <Field label={p.price} name="price" type="number" inputMode="decimal" min={0} max={100000} step="0.01" required placeholder="25.00" />
            <Field label={p.duration} name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={30} />
            <PendingButton className="btn-primary w-full">{p.addButton}</PendingButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
