import { Check } from "lucide-react";
import Link from "@/components/locale-link";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { PlanSwitcher } from "./plan-switcher";
import { PLANS, PRICING_IS_PLACEHOLDER, TWILIO_ESTIMATE_GEL, formatGel } from "@/lib/pricing";

/** Plan cards, driven by lib/pricing.ts. Used on /pricing and the home page. */
export async function PricingPlans({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const { locale, t } = await getI18n();
  const p = t.pricing;
  const intl = INTL_LOCALE[locale];
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div>
      <PlanSwitcher plans={PLANS.map((plan) => ({ id: plan.id, name: p.plans[plan.id].name }))} defaultId="studio" label={p.picker}>
      <ul className="plans">
        {PLANS.map((plan) => {
          const copy = p.plans[plan.id];
          return (
            <li key={plan.id} data-plan={plan.id} className={`bf-card plan ${plan.featured ? "featured" : ""}`}>
              {plan.featured && <span className="plan-badge">{p.popular}</span>}
              <H className="plan-name">{copy.name}</H>
              <p className="plan-blurb">{copy.blurb}</p>
              <p className="plan-price">
                <span className="amount">{formatGel(plan.monthlyGel, intl)}</span> <span className="per">{p.perMonth}</span>
              </p>
              <p className="plan-seats">{plan.maxBarbers === 1 ? p.oneBarber : fmt(p.upTo, { n: plan.maxBarbers })}</p>
              <ul className="plan-features">
                {copy.features.map((f) => (
                  <li key={f}>
                    <Check aria-hidden="true" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link className={`bf-btn ${plan.featured ? "bf-btn-p" : "bf-btn-g"}`} href={`/signup?plan=${plan.id}`}>
                {fmt(p.choose, { plan: copy.name })}
              </Link>
            </li>
          );
        })}
      </ul>
      </PlanSwitcher>
      <div className="plan-notes">
        <p>
          <strong>{p.twilioTitle}.</strong>{" "}
          {fmt(p.twilioNote, { minute: formatGel(TWILIO_ESTIMATE_GEL.perMinute, intl), sms: formatGel(TWILIO_ESTIMATE_GEL.perSms, intl) })}
        </p>
        <p>{p.vat}</p>
        {PRICING_IS_PLACEHOLDER && <p className="plan-placeholder">{p.placeholder}</p>}
      </div>
    </div>
  );
}
