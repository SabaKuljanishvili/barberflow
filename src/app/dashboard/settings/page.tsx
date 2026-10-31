import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import { Field, SelectField } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { TimeField } from "@/components/ui/time-field";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { requireManager } from "@/lib/auth";
import { DEFAULT_TIMEZONE, timeZoneLabel } from "@/lib/time";
import { updateSalonSettings } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.settings.title };
}

export default async function SettingsPage() {
  const { salon } = await requireManager();
  const { t } = await getI18n();
  const p = t.dashboard.settings;
  // Tbilisi first. The ICU list omits aliases such as "UTC", so a stored value
  // missing from it is added back; otherwise the select would silently show
  // the first entry (Africa/Abidjan) and save that.
  const zones = [...new Set([DEFAULT_TIMEZONE, salon.timezone, ...Intl.supportedValuesOf("timeZone")])];

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/settings", label: p.title }]} />
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.heading}</h1>

      <ActionForm action={updateSalonSettings} resetOnSuccess={false} className="grid gap-6 xl:grid-cols-2" aria-label={p.heading}>
        <section aria-labelledby="general" className="card space-y-4">
          <h2 id="general" className="text-lg font-semibold">
            {p.general}
          </h2>
          <Field label={p.shopName} name="name" required maxLength={120} defaultValue={salon.name} />
          <SelectField label={p.timezone} name="timezone" defaultValue={salon.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {timeZoneLabel(z, t.dashboard.tbilisi)}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <TimeField label={p.opensAt} name="opensAt" defaultValue={salon.opens_at.slice(0, 5)} />
            <TimeField label={p.closesAt} name="closesAt" defaultValue={salon.closes_at.slice(0, 5)} />
          </div>
          <fieldset>
            <legend className="label">{p.openDays}</legend>
            <div className="flex flex-wrap gap-2">
              {t.days.map((d, i) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-brand-soft">
                  <input type="checkbox" name="workingDays" value={i + 1} defaultChecked={salon.working_days.includes(i + 1)} className="accent-brand" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="voice" className="card space-y-4 self-start">
          <h2 id="voice" className="text-lg font-semibold">
            {p.voice}
          </h2>
          <PhoneField label={p.phone} name="phoneNumber" defaultValue={salon.phone_number} hint={p.phoneHint} />
          <SelectField label={p.language} name="locale" defaultValue={salon.locale} hint={p.languageHint}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </SelectField>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="voiceAgentEnabled" defaultChecked={salon.voice_agent_enabled} className="size-4 accent-brand" />
            {p.enabled}
          </label>
          <div className="rounded-2xl bg-canvas p-4 text-sm text-muted">
            <p className="font-medium text-ink">{p.twilioSetup}</p>
            <p className="mt-1">
              {p.twilioBefore} <code className="break-all text-ink">/api/voice/incoming</code>
              {p.twilioStatus} <code className="break-all text-ink">/api/voice/status</code> {p.twilioSms}{" "}
              <code className="break-all text-ink">/api/sms/incoming</code> {p.twilioAfter}
            </p>
          </div>
          <PendingButton className="btn-primary w-full">{p.save}</PendingButton>
        </section>
      </ActionForm>
    </div>
  );
}
