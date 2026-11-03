import { JsonLd } from "@/components/json-ld";
import { getI18n } from "@/i18n/server";

/** FAQ as native <details> (works without JS, keyboard friendly) plus FAQPage structured data. */
export async function Faq() {
  const { t } = await getI18n();
  const f = t.faq;
  return (
    <section aria-labelledby="faq" className="faq">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: f.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
        }}
      />
      <div className="sec-head">
        <span className="eyebrow">{f.eyebrow}</span>
        <h2 id="faq" className="serif h2">
          {f.title}
        </h2>
      </div>
      <div className="faq-list">
        {f.items.map((i) => (
          <details key={i.q} className="faq-item">
            <summary>{i.q}</summary>
            <p className="p">{i.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
