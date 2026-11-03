import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { PasswordField } from "@/components/ui/password-field";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { changeEmail, changePassword, deleteSalon, updateAccount } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.account.title };
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ setPassword?: string; emailChanged?: string }> }) {
  const { profile, salon, isManager } = await requireUser();
  const { setPassword, emailChanged } = await searchParams;
  const { t } = await getI18n();
  const p = t.dashboard.account;

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/account", label: p.title }]} />
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
      {emailChanged && (
        <p role="status" className="rounded-2xl bg-brand-soft px-4 py-3 text-sm text-accent">
          {p.emailChanged}
        </p>
      )}
      {setPassword && (
        <p role="status" className="rounded-2xl bg-brand-soft px-4 py-3 text-sm text-accent">
          {p.welcome}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="details" className="card">
          <h2 id="details" className="text-lg font-semibold">
            {p.details}
          </h2>
          <ActionForm action={updateAccount} resetOnSuccess={false} className="mt-4 space-y-4" aria-label={p.details}>
            <Field label={p.fullName} name="fullName" required maxLength={120} autoComplete="name" defaultValue={profile.full_name} />
            {!isManager && <Field label={p.email} name="email" type="email" disabled defaultValue={profile.email} hint={p.emailHint} />}
            <PhoneField label={p.mobile} name="phone" autoComplete="tel-national" defaultValue={profile.phone} />
            <PendingButton>{p.saveDetails}</PendingButton>
          </ActionForm>
        </section>

        {isManager && (
          <section aria-labelledby="email" className="card">
            <h2 id="email" className="text-lg font-semibold">
              {p.changeEmail}
            </h2>
            <ActionForm action={changeEmail} resetOnSuccess={false} className="mt-4 space-y-4" aria-label={p.changeEmail}>
              <Field label={p.email} name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={profile.email} hint={p.emailHintManager} />
              <PendingButton>{p.changeEmail}</PendingButton>
            </ActionForm>
          </section>
        )}

        <section aria-labelledby="password" className="card">
          <h2 id="password" className="text-lg font-semibold">
            {p.password}
          </h2>
          <ActionForm action={changePassword} className="mt-4 space-y-4" aria-label={p.changePassword}>
            <PasswordField label={p.currentPassword} name="currentPassword" autoComplete="current-password" required maxLength={72} />
            <PasswordField label={p.newPassword} name="password" autoComplete="new-password" required minLength={10} maxLength={72} hint={p.passwordHint} />
            <PasswordField label={p.confirmPassword} name="confirm" autoComplete="new-password" required minLength={10} maxLength={72} />
            <PendingButton>{p.updatePassword}</PendingButton>
          </ActionForm>
        </section>
      </div>

      {isManager && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section aria-labelledby="data" className="card">
            <h2 id="data" className="text-lg font-semibold">
              {p.data}
            </h2>
            <p className="mt-1 text-sm text-muted">{p.dataIntro}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Plain links: the route streams a CSV download. */}
              <a href="/dashboard/export?type=clients" className="btn-secondary" download>
                {p.exportClients}
              </a>
              <a href="/dashboard/export?type=appointments" className="btn-secondary" download>
                {p.exportAppointments}
              </a>
            </div>
          </section>

          <section aria-labelledby="delete-salon" className="card border-danger/40">
            <h2 id="delete-salon" className="text-lg font-semibold text-danger">
              {p.deleteSalon}
            </h2>
            <p className="mt-1 text-sm text-muted">{fmt(p.deleteSalonBody, { salon: salon.name })}</p>
            <ActionForm action={deleteSalon} resetOnSuccess={false} className="mt-4 space-y-3" aria-label={p.deleteSalon}>
              <Field label={fmt(p.typeSalonName, { salon: salon.name })} name="salonName" required autoComplete="off" spellCheck={false} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirm" required className="mt-0.5 size-4 accent-brand" />
                {p.deleteSalonConfirm}
              </label>
              <PendingButton className="btn-danger w-full">{p.deleteSalonButton}</PendingButton>
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}
