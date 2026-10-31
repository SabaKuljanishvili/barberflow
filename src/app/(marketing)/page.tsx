import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { CallCard } from "@/components/marketing/call-card";
import { Features } from "@/components/marketing/features";
import { localBusinessSchema, organizationSchema, softwareSchema } from "@/lib/structured-data";
import { site } from "@/lib/site";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${site.name} | ${t.meta.tagline}` },
    description: t.meta.description,
    alternates: { canonical: "/" },
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

      <section id="top" className="wrap bf-cb hero-sec">
        <div className="hero">
          <div>
            <span className="eyebrow r d1">{h.eyebrow}</span>
            <h1 className="serif h1 r d2">
              {h.titleBefore}
              <em>{h.titleEm}</em>
              {h.titleAfter}
            </h1>
            <p className="lede r d3">{h.lede}</p>
            <div className="ctas r d4">
              <Link className="bf-btn bf-btn-p" href="/signup">
                {h.ctaPrimary}
                <Arrow />
              </Link>
              <Link className="bf-btn bf-btn-g" href="/contact">
                {h.ctaSecondary}
              </Link>
            </div>
          </div>
          {/* The booked barber's initial, as on the booking card. */}
          <CallCard text={h.call} initial={h.scenes.barbers[0][0]} />
        </div>
      </section>

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
