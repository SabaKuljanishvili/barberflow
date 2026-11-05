import type { Metadata } from "next";
import Link from "@/components/locale-link";
import { JsonLd } from "@/components/json-ld";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { localBusinessSchema, organizationSchema, softwareSchema } from "@/lib/structured-data";
import { site } from "@/lib/site";
import { AgentSample } from "@/components/marketing/agent-sample";
import { Faq } from "@/components/marketing/faq";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { getI18n, pageAlternates } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${site.name} | ${t.meta.tagline}` },
    description: t.meta.description,
    alternates: await pageAlternates("/"),
  };
}

function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default async function HomePage() {
  const { t } = await getI18n();
  const h = t.home;
  const business = localBusinessSchema();
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareSchema(t.meta.description)} />
      {business && <JsonLd data={business} />}

      <Hero />

      <Features home={h} />

      <section aria-labelledby="how" className="wrap bf-cb sec">
        <div className="sec-head sr">
          <span className="eyebrow">{h.stepsEyebrow}</span>
          <h2 id="how" className="serif h2">
            {h.stepsTitle}
          </h2>
        </div>
        <ol className="steps">
          <li className="track" aria-hidden="true">
            <i />
          </li>
          {h.steps.map((step, i) => (
            <li key={step.title} className="sr">
              <span className="dot">{i + 1}</span>
              <h3 className="st">{step.title}</h3>
              <p className="p">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <AgentSample />

      <section aria-labelledby="pricing" className="wrap bf-cb sec">
        <div className="sec-head sr">
          <span className="eyebrow">{t.pricing.eyebrow}</span>
          <h2 id="pricing" className="serif h2">
            {t.pricing.heading}
          </h2>
          <p className="p">{t.pricing.intro}</p>
        </div>
        <PricingPlans headingLevel={3} />
        <Faq />
      </section>

      <section className="wrap bf-cb">
        <div className="closer sr">
          <div>
            <h2 className="serif big">
              {h.ctaTitleBefore}
              <span>{h.ctaTitleEm}</span>
              {h.ctaTitleAfter}
            </h2>
            <p className="p">{h.ctaBody}</p>
          </div>
          <Link className="bf-btn bf-btn-p" href="/signup">
            {h.ctaButton}
            <Arrow />
          </Link>
        </div>
      </section>
    </>
  );
}
