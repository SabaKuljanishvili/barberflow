import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { INTL_LOCALE } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { LEGAL_LAST_UPDATED, legalPages, type LegalKey } from "@/lib/site";

export async function LegalPage({ page, intro, children }: { page: LegalKey; intro: string; children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const href = `/legal/${page}`;
  const title = t.legal.pages[page].title;
  const updated = new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_240px]">
      <article className="card p-8 sm:p-10">
        <Breadcrumbs
          items={[
            { href: "/", label: t.nav.home },
            { href: "/legal", label: t.legal.title },
            { href, label: title },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {t.legal.lastUpdated} <time dateTime={LEGAL_LAST_UPDATED}>{updated}</time>
        </p>
        <p className="mt-6 leading-7 text-muted">{intro}</p>
        <div className="prose-legal">{children}</div>
      </article>
      <aside aria-label={t.legal.otherPolicies} className="lg:sticky lg:top-6 lg:self-start">
        <nav className="card p-5">
          <h2 className="text-sm font-semibold">{t.legal.policies}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {legalPages.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={p.href === href ? "page" : undefined}
                  className={`block rounded-2xl px-3 py-2 ${p.href === href ? "bg-brand-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink"}`}
                >
                  {t.legal.pages[p.key].title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
