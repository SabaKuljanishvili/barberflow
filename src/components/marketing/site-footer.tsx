import Link from "next/link";
import { ScissorsIcon } from "@/components/logo";
import { getI18n } from "@/i18n/server";
import { legalPages, marketingNav, site } from "@/lib/site";
import { businessDetails } from "@/lib/env.server";

export async function SiteFooter() {
  const { t } = await getI18n();
  const biz = businessDetails();
  const year = new Date().getFullYear();
  return (
    <footer className="wrap bf-cb">
      <div className="fgrid">
        <div>
          <div className="row fbrand">
            <span className="brand-mark">
              <ScissorsIcon size={15} />
            </span>
            <span className="brand-name">{site.name}</span>
          </div>
          <p className="p fdesc">{t.footer.tagline}</p>
        </div>
        <nav aria-label={t.footer.label}>
          <h2 className="fh">{t.footer.company}</h2>
          {marketingNav.map((item) => (
            <Link key={item.href} className="fl" href={item.href}>
              {t.nav[item.key]}
            </Link>
          ))}
        </nav>
        <nav aria-label={t.footer.legal}>
          <h2 className="fh">{t.footer.legal}</h2>
          {legalPages.map((item) => (
            <Link key={item.href} className="fl" href={item.href}>
              {t.legal.pages[item.key].title}
            </Link>
          ))}
        </nav>
      </div>
      <p className="fcopy">
        © {year} {biz.legalName ?? site.name}. {t.footer.rights}
      </p>
    </footer>
  );
}
