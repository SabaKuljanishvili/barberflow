import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { getI18n } from "@/i18n/server";
import { legalPages, marketingNav, site } from "@/lib/site";
import { businessDetails } from "@/lib/env.server";

export async function SiteFooter() {
  const { t } = await getI18n();
  const biz = businessDetails();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="font-bold">{site.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{t.meta.description}</p>
        </div>
        <nav aria-label={t.footer.label}>
          <h2 className="text-sm font-semibold text-ink">{t.footer.company}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {marketingNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted hover:text-brand-700">
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t.footer.legal}>
          <h2 className="text-sm font-semibold text-ink">{t.footer.legal}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {legalPages.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted hover:text-brand-700">
                  {t.legal.pages[item.key].title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
          © {year} {biz.legalName ?? site.name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
