import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarCheck, PhoneCall, ShieldCheck, Users, Archive } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { localBusinessSchema, organizationSchema, softwareSchema } from "@/lib/structured-data";
import { site } from "@/lib/site";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${site.name} | ${t.meta.tagline}` },
    description: t.meta.description,
    alternates: { canonical: "/" },
  };
}

// Same order as t.home.features.
const featureIcons = [PhoneCall, CalendarCheck, BellRing, Users, ShieldCheck, Archive];

export default async function HomePage() {
  const { t } = await getI18n();
  const business = localBusinessSchema();
  const features = t.home.features.map((f, i) => ({ ...f, icon: featureIcons[i] }));
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareSchema(t.meta.description)} />
      {business && <JsonLd data={business} />}

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900">
          {t.home.eyebrow}
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-6xl">
          {t.home.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{t.meta.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            {t.home.ctaPrimary}
          </Link>
          <Link href="/contact" className="btn-secondary px-6 py-3 text-base">
            {t.home.ctaSecondary}
          </Link>
        </div>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="features" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.home.featuresTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className={`card ${i === 0 ? "bg-brand-900 text-white lg:row-span-2" : ""}`}>
              <span
                className={`inline-flex size-11 items-center justify-center rounded-2xl ${i === 0 ? "bg-white/10 text-brand-100" : "bg-brand-50 text-brand-700"}`}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className={`mt-4 text-lg font-semibold ${i === 0 ? "text-white" : "text-ink"}`}>{title}</h3>
              <p className={`mt-2 text-sm leading-6 ${i === 0 ? "text-brand-100" : "text-muted"}`}>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <h2 id="how" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.home.stepsTitle}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {t.home.steps.map((step, i) => (
            <li key={step.title} className="card">
              <span className="text-sm font-semibold text-brand-700">{fmt(t.home.stepLabel, { n: i + 1 })}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="card flex flex-col items-start justify-between gap-6 bg-brand-50 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-brand-900">{t.home.ctaTitle}</h2>
            <p className="mt-2 text-muted">{t.home.ctaBody}</p>
          </div>
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            {t.home.ctaButton}
          </Link>
        </div>
      </section>
    </>
  );
}
