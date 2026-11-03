import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field, SelectField } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { requireManager } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { inviteBarber, removeStaff, resendInvite, updateStaff } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.team.title };
}

/** Members who never signed in still have a pending invite. Never throws. */
async function pendingInvites(ids: string[]): Promise<Set<string>> {
  try {
    const admin = createSupabaseAdminClient();
    const users = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id)));
    return new Set(users.filter((u) => u.data.user && !u.data.user.last_sign_in_at).map((u) => u.data.user!.id));
  } catch {
    return new Set();
  }
}

export default async function TeamPage() {
  const { userId } = await requireManager();
  const { t } = await getI18n();
  const p = t.dashboard.team;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").order("role").order("full_name");
  const team = data ?? [];
  const pending = await pendingInvites(team.filter((m) => m.id !== userId).map((m) => m.id));

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
            {team.map((m) => {
              const self = m.id === userId;
              return (
                <li key={m.id} className={`py-3 ${m.active ? "" : "opacity-70"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {m.full_name} {self && <span className="text-sm font-normal text-muted">{p.you}</span>}
                      </p>
                      <p className="text-sm text-muted">{m.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-accent">{t.roles[m.role]}</span>
                      {pending.has(m.id) && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-warn">{p.pending}</span>}
                      {!m.active && <span className="rounded-full bg-busy px-2.5 py-1 text-muted">{p.inactive}</span>}
                      {m.active && !m.takes_clients && <span className="rounded-full bg-busy px-2.5 py-1 text-muted">{p.notTakingClients}</span>}
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-accent">{p.manage}</summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <ActionForm action={updateStaff} resetOnSuccess={false} className="space-y-3" aria-label={fmt(p.manageLabel, { name: m.full_name })}>
                        <input type="hidden" name="id" value={m.id} />
                        {self ? (
                          <>
                            <input type="hidden" name="role" value={m.role} />
                            <p className="text-xs text-muted">{p.selfNote}</p>
                          </>
                        ) : (
                          <>
                            <SelectField id={`role-${m.id}`} label={p.role} name="role" defaultValue={m.role}>
                              <option value="barber">{t.roles.barber}</option>
                              <option value="manager">{t.roles.manager}</option>
                            </SelectField>
                            <label className="flex items-start gap-3 text-sm">
                              <input type="checkbox" name="active" defaultChecked={m.active} className="mt-0.5 size-4 accent-brand" />
                              {p.active}
                            </label>
                          </>
                        )}
                        <label className="flex items-start gap-3 text-sm">
                          <input type="checkbox" name="takesClients" defaultChecked={m.takes_clients} className="mt-0.5 size-4 accent-brand" />
                          {p.takesClients}
                        </label>
                        <PendingButton className="btn-primary py-1.5">{p.save}</PendingButton>
                      </ActionForm>

                      {!self && (
                        <div className="space-y-3">
                          {pending.has(m.id) && (
                            <ActionForm action={resendInvite} resetOnSuccess={false} aria-label={p.resend}>
                              <input type="hidden" name="id" value={m.id} />
                              <PendingButton className="btn-secondary py-1.5" pendingLabel={p.sending}>
                                {p.resend}
                              </PendingButton>
                            </ActionForm>
                          )}
                          <ActionForm action={removeStaff} resetOnSuccess={false} className="space-y-1" aria-label={fmt(p.removeLabel, { name: m.full_name })}>
                            <input type="hidden" name="id" value={m.id} />
                            <p className="text-xs text-muted">{p.removeHint}</p>
                            <PendingButton className="btn-danger py-1.5" pendingLabel={p.removing}>
                              {p.remove}
                              <span className="sr-only"> {m.full_name}</span>
                            </PendingButton>
                          </ActionForm>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
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
