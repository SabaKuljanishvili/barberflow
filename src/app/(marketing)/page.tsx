import type { Metadata } from "next";
import Link from "@/components/locale-link";
import type { CSSProperties } from "react";
import { JsonLd } from "@/components/json-ld";
import { CallStream } from "@/components/marketing/call-stream";
import { isoDateIn } from "@/components/marketing/call-stream-data";
import { Features } from "@/components/marketing/features";
import { HeroHeadline } from "@/components/marketing/hero-headline";
import { splitHeadline } from "@/components/marketing/hero-headline-data";
import { localBusinessSchema, organizationSchema, softwareSchema } from "@/lib/structured-data";
import { site } from "@/lib/site";
import { AgentSample } from "@/components/marketing/agent-sample";
import { Faq } from "@/components/marketing/faq";
import { FeaturesCarousel } from "@/components/marketing/features-carousel";
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
  const { locale, t } = await getI18n();
  const h = t.home;
  const title = { before: h.titleBefore, green: h.titleGreen, after: h.titleAfter };
  const business = localBusinessSchema();
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareSchema(t.meta.description)} />
      {business && <JsonLd data={business} />}

      <section id="top" className="wrap bf-cb hero-sec">
        <div className="hero">
          <div>
            <span className="eyebrow">
              <i aria-hidden="true" />
              {h.eyebrow}
            </span>
            <HeroHeadline text={title} />
            {/* Lede and buttons rise in just before the last letter lands. */}
            <div style={{ "--after": `${splitHeadline(title).after}ms` } as CSSProperties}>
              <p className="lede">{h.lede}</p>
              <div className="ctas">
                <Link className="bf-btn bf-btn-p" href="/signup">
                  {h.ctaPrimary}
                  <Arrow />
                </Link>
                <Link className="bf-btn bf-btn-g" href="/contact">
                  {h.ctaSecondary}
                </Link>
              </div>
              <ul className="hero-chips m-only">
                {h.chips.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          {/* "Today" for the booking dates, in the shop's time zone. */}
          <CallStream text={h.callStream} locale={locale} today={isoDateIn("Asia/Tbilisi")} />
        </div>
      </section>

      {/* One anchor for both layouts: desktop showcase, phone carousel. */}
      <div id="features">
        <Features home={h} />
        <FeaturesCarousel home={h} />
      </div>

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
