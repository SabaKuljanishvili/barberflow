// Plans shown on /pricing, the home page and (later) Billing. Labels and
// feature lists live in the dictionaries under `pricing.plans.<id>`.
//
// TODO(owner): every number below is a PLACEHOLDER. Replace the prices and
// the Twilio estimate with real values, then set PRICING_IS_PLACEHOLDER to
// false (it shows a "preliminary prices" note on the site while true).
export const PRICING_IS_PLACEHOLDER = true;

export type PlanId = "solo" | "studio" | "pro";

export const PLANS: { id: PlanId; monthlyGel: number; maxBarbers: number; featured: boolean }[] = [
  { id: "solo", monthlyGel: 49, maxBarbers: 1, featured: false },
  { id: "studio", monthlyGel: 99, maxBarbers: 5, featured: true },
  { id: "pro", monthlyGel: 179, maxBarbers: 15, featured: false },
];

/** Twilio usage is billed on top, at cost. Rough GEL estimate for Georgian numbers. */
export const TWILIO_ESTIMATE_GEL = { perMinute: 0.3, perSms: 0.25 };

export function formatGel(amount: number, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency: "GEL", maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}
