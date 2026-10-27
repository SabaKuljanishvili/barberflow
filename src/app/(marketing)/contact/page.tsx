import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { businessDetails } from "@/lib/env.server";
import { localBusinessSchema } from "@/lib/structured-data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.contact.title, description: t.contact.description, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const { t } = await getI18n();
  const b = businessDetails();
  const schema = localBusinessSchema();
  const address = [b.street, b.city, b.region, b.postalCode, b.country].filter(Boolean).join(", ");
  const hasAny = b.email || b.phone || address;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {schema && <JsonLd data={schema} />}
      <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { href: "/contact", label: t.contact.title }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.contact.heading}</h1>
      <p className="mt-3 text-muted">{t.contact.intro}</p>

      <section aria-labelledby="business" className="card mt-8">
        <h2 id="business" className="text-lg font-semibold">
          {t.contact.business}
        </h2>
        {hasAny ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {b.legalName && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">{t.contact.legalName}</dt>
                <dd className="font-medium">{b.legalName}</dd>
              </div>
            )}
            {b.email && (
              <div className="flex gap-3">
                <Mail aria-hidden className="mt-0.5 size-5 text-brand-700" />
                <div>
                  <dt className="text-sm text-muted">{t.contact.email}</dt>
                  <dd>
                    <a href={`mailto:${b.email}`} className="font-medium text-brand-700 underline underline-offset-2">
                      {b.email}
                    </a>
                  </dd>
                </div>
              </div>
            )}
            {b.phone && (
              <div className="flex gap-3">
                <Phone aria-hidden className="mt-0.5 size-5 text-brand-700" />
                <div>
                  <dt className="text-sm text-muted">{t.contact.phone}</dt>
                  <dd>
                    <a href={`tel:${b.phone}`} className="font-medium text-brand-700 underline underline-offset-2">
                      {b.phone}
                    </a>
                  </dd>
                </div>
              </div>
            )}
            {address && (
              <div className="flex gap-3 sm:col-span-2">
                <MapPin aria-hidden className="mt-0.5 size-5 text-brand-700" />
                <div>
                  <dt className="text-sm text-muted">{t.contact.address}</dt>
                  <dd className="font-medium">{address}</dd>
                </div>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {t.contact.empty}
          </p>
        )}
      </section>
    </div>
  );
}
