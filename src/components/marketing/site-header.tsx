import Link from "@/components/locale-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

/** Outline of the brand star, drawn in the accent green for the dark header. */
function StarMark() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 1.5C12.6 7.5 16.5 11.4 22.5 12C16.5 12.6 12.6 16.5 12 22.5C11.4 16.5 7.5 12.6 1.5 12C7.5 11.4 11.4 7.5 12 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Marketing header (home, pricing, contact, legal, 404): a floating, sticky
 * bar, 24px from the top (12px on phones). Styles: landing.css `.bf-header`.
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
    <div className="bf-header-bar">
      <header className="bf-header r">
        <Link href="/" className="brand" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
          <StarMark />
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
            labels={{ open: t.nav.openMenu, close: t.nav.closeMenu, title: t.nav.menu, signIn: t.nav.signIn, start: t.nav.start }}
          >
            <LocaleSwitcher variant="square" />
          </MobileMenu>
        </div>
      </header>
    </div>
  );
}
