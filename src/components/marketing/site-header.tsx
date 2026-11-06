import Link from "@/components/locale-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";
import { AppLogo } from "./app-logo";
import { HeaderBar } from "./header-bar";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

/**
 * Marketing header (home, pricing, contact, legal, 404): an opaque floating,
 * sticky bar, 24px from the top (12px once scrolled, and on phones).
 * Styles: landing.css `.bf-header`.
 */
export async function SiteHeader() {
  const { t } = await getI18n();
  const nav = [
    { href: "/", label: t.nav.home },
    { href: "/#features", label: t.nav.features },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/contact", label: t.nav.contact },
  ];
  return (
    <HeaderBar>
      <header className="bf-header r">
        <Link href="/" className="brand" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
          <AppLogo size={30} />
          <span className="brand-name">{site.name}</span>
        </Link>
        <NavLinks items={nav} label={t.nav.main} />
        <div className="hright">
          <div className="hdesk">
            <LocaleSwitcher variant="square" />
            <Link className="hsignin" href="/login">
              {t.nav.signIn}
            </Link>
          </div>
          <Link className="hstart" href="/signup">
            {t.nav.start}
          </Link>
          <MobileMenu
            items={nav}
            brand={site.name}
            labels={{ open: t.nav.openMenu, close: t.nav.closeMenu, title: t.nav.menu, signIn: t.nav.signIn, start: t.nav.start }}
          >
            <LocaleSwitcher variant="square" />
          </MobileMenu>
        </div>
      </header>
    </HeaderBar>
  );
}
