import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Faq } from "@/components/marketing/faq";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { getI18n, pageAlternates } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pricing.title, description: t.pricing.description, alternates: await pageAlternates("/pricing") };
}

export default async function PricingPage() {
  const { t } = await getI18n();
  return (
    <div className="wrap bf-cb sec pt-10">
      <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { href: "/pricing", label: t.pricing.title }]} />
      <div className="sec-head">
        <span className="eyebrow">{t.pricing.eyebrow}</span>
        <h1 className="serif h2">{t.pricing.heading}</h1>
        <p className="p">{t.pricing.intro}</p>
      </div>
      <PricingPlans />
      <Faq />
    </div>
  );
}
