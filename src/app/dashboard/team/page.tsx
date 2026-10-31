import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { inviteBarber, removeStaff } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.team.title };
}

export default async function TeamPage() {
  const { userId } = await requireManager();
  const { t } = await getI18n();
  const p = t.dashboard.team;
  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase.from("profiles").select("*").order("role").order("full_name");

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/team", label: p.title }]} />
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="list" className="card xl:col-span-2">
          <h2 id="list" className="text-lg font-semibold">
            {p.staff}
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {(team ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {m.full_name} {m.id === userId && <span className="text-sm font-normal text-muted">{p.you}</span>}
                  </p>
                  <p className="text-sm text-muted">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-accent">{t.roles[m.role]}</span>
                  {m.id !== userId && (
                    <ActionForm action={removeStaff} resetOnSuccess={false} className="flex flex-col items-end gap-1" aria-label={fmt(p.removeLabel, { name: m.full_name })}>
                      <input type="hidden" name="id" value={m.id} />
                      <PendingButton className="btn-danger py-1.5" pendingLabel={p.removing}>
                        {p.remove}<span className="sr-only"> {m.full_name}</span>
                      </PendingButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="invite" className="card self-start">
          <h2 id="invite" className="text-lg font-semibold">
            {p.invite}
          </h2>
          <p className="mt-1 text-sm text-muted">{p.inviteIntro}</p>
          <ActionForm action={inviteBarber} className="mt-4 space-y-4" aria-label={p.invite}>
            <Field label={p.fullName} name="fullName" required maxLength={120} autoComplete="off" />
            <Field label={p.email} name="email" type="email" required autoComplete="off" />
            <PhoneField label={p.mobile} name="phone" autoComplete="off" />
            <PendingButton className="btn-primary w-full" pendingLabel={p.sending}>
              {p.send}
            </PendingButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
