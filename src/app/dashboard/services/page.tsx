import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { requireManager } from "@/lib/auth";
import { money } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { createService, deleteService, moveService, updateService } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.services.title };
}

export default async function ServicesPage() {
  await requireManager();
  const { t } = await getI18n();
  const p = t.dashboard.services;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("services").select("*").order("sort_order").order("name");
  const services = data ?? [];

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
          {services.length ? (
            <ol className="mt-4 space-y-3" aria-label={p.order}>
              {services.map((s, i) => (
                <li key={s.id} className={`rounded-2xl border border-line p-4 ${s.active ? "" : "bg-canvas"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <ActionForm action={moveService} resetOnSuccess={false} showMessage={false} aria-label={fmt(p.moveUp, { name: s.name })}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="dir" value="up" />
                        <PendingButton className="btn-secondary px-2 py-1" pendingLabel="…" disabled={i === 0} aria-label={fmt(p.moveUp, { name: s.name })}>
                          <ArrowUp aria-hidden className="size-4" />
                        </PendingButton>
                      </ActionForm>
                      <ActionForm action={moveService} resetOnSuccess={false} showMessage={false} aria-label={fmt(p.moveDown, { name: s.name })}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="dir" value="down" />
                        <PendingButton
                          className="btn-secondary px-2 py-1"
                          pendingLabel="…"
                          disabled={i === services.length - 1}
                          aria-label={fmt(p.moveDown, { name: s.name })}
                        >
                          <ArrowDown aria-hidden className="size-4" />
                        </PendingButton>
                      </ActionForm>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            <span className="mr-2 text-sm tabular-nums text-muted">{i + 1}.</span>
                            {s.name}
                            {!s.active && <span className="ml-2 rounded-full bg-busy px-2 py-0.5 text-xs font-medium text-muted">{p.hidden}</span>}
                          </p>
                          <p className="text-sm text-muted">{fmt(p.minutes, { n: s.duration_minutes })}</p>
                        </div>
                        <p className="text-lg font-bold text-accent tabular-nums">{money(s.price)}</p>
                      </div>

                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-accent">{p.edit}</summary>
                        <ActionForm action={updateService} resetOnSuccess={false} className="mt-3 space-y-3" aria-label={fmt(p.editLabel, { name: s.name })}>
                          <input type="hidden" name="id" value={s.id} />
                          <Field id={`name-${s.id}`} label={p.name} name="name" required maxLength={80} defaultValue={s.name} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                              id={`price-${s.id}`}
                              label={p.price}
                              name="price"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100000}
                              step="0.01"
                              required
                              defaultValue={String(s.price)}
                            />
                            <Field
                              id={`dur-${s.id}`}
                              label={p.duration}
                              name="durationMinutes"
                              type="number"
                              min={5}
                              max={480}
                              step={5}
                              required
                              defaultValue={s.duration_minutes}
                            />
                          </div>
                          <label className="flex items-center gap-3 text-sm">
                            <input type="checkbox" name="active" defaultChecked={s.active} className="size-4 accent-brand" />
                            {p.active}
                          </label>
                          <PendingButton className="btn-primary">{p.save}</PendingButton>
                        </ActionForm>
                        <ActionForm action={deleteService} resetOnSuccess={false} className="mt-4 space-y-2 border-t border-line pt-3" aria-label={fmt(p.removeLabel, { name: s.name })}>
                          <input type="hidden" name="id" value={s.id} />
                          <label className="flex items-center gap-3 text-sm">
                            <input type="checkbox" name="confirm" required className="size-4 accent-brand" />
                            {fmt(p.confirmDelete, { name: s.name })}
                          </label>
                          <PendingButton className="btn-danger py-1.5" pendingLabel={p.removing}>
                            {p.remove}
                            <span className="sr-only"> {s.name}</span>
                          </PendingButton>
                        </ActionForm>
                      </details>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
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
            <Field label={p.price} name="price" type="number" inputMode="decimal" min={0} max={100000} step="0.01" required placeholder={p.pricePlaceholder} />
            <Field label={p.duration} name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={30} />
            <PendingButton className="btn-primary w-full">{p.addButton}</PendingButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
