import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireManager } from "@/lib/auth";
import { PLANS, formatGel } from "@/lib/pricing";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { localizedPath } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.billing.title };
}

// Placeholder until online payments exist: subscription status from the
// salon row and the plans from lib/pricing.ts (same source as /pricing).
export default async function BillingPage() {
  const { salon } = await requireManager();
  const { locale, t } = await getI18n();
  const b = t.dashboard.billing;
  const intl = INTL_LOCALE[locale];

  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/billing", label: b.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{b.title}</h1>
        <p className="mt-1 text-sm text-muted">{b.intro}</p>
      </div>

      <section className="card">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">{b.plan}</dt>
            <dd className="mt-1 font-semibold">{b.noPlan}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{b.status}</dt>
            <dd className="mt-1 font-semibold">{b.statuses[salon.subscription_status]}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{b.nextInvoice}</dt>
            <dd className="mt-1 font-semibold">{b.none}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="plans" className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans" className="text-lg font-semibold">
            {b.plans}
          </h2>
          <Link href={localizedPath(locale, "/pricing")} className="text-sm font-medium text-accent">
            {b.comparePlans}
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <li key={plan.id} className={`rounded-2xl border p-4 ${plan.featured ? "border-accent" : "border-line"}`}>
              <p className="font-semibold">{t.pricing.plans[plan.id].name}</p>
              <p className="text-sm text-muted">{t.pricing.plans[plan.id].blurb}</p>
              <p className="mt-2 font-bold tabular-nums">{fmt(b.perMonth, { price: formatGel(plan.monthlyGel, intl) })}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{b.phoneCosts}</p>
      </section>
    </div>
  );
}
