import Link from "@/components/locale-link";
import { BrandMark } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";

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
      <header className="wrap bf-cb bf-header r">
        <Link href="/" className="brand" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
          <BrandMark />
          <span className="brand-name">{site.name}</span>
        </Link>
        <nav className="navlinks" aria-label={t.nav.main}>
          {nav.map((item) => (
            <Link key={item.href} className="navlink" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hright">
          <div className="hdesk">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link className="navlink" href="/login">
              {t.nav.signIn}
            </Link>
          </div>
          <Link className="bf-btn bf-btn-p bf-btn-sm" href="/signup">
            {t.nav.start}
          </Link>
          <MobileMenu
            items={nav}
            labels={{ open: t.nav.openMenu, close: t.nav.closeMenu, title: t.nav.menu, signIn: t.nav.signIn, start: t.nav.start }}
          >
            <LocaleSwitcher />
            <ThemeToggle />
          </MobileMenu>
        </div>
      </header>
    </div>
  );
}
