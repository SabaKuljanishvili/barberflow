import Link from "next/link";
import { ScissorsIcon } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";

export async function SiteHeader() {
  const { t } = await getI18n();
  const nav = [
    { href: "/", label: t.nav.home },
    { href: "/#features", label: t.nav.features },
    { href: "/contact", label: t.nav.contact },
  ];
  return (
    <header className="wrap bf-cb bf-header r">
      <Link href="/" className="brand" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
        <span className="brand-mark">
          <ScissorsIcon />
        </span>
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
        <LocaleSwitcher />
        <ThemeToggle />
        <Link className="navlink" href="/login">
          {t.nav.signIn}
        </Link>
        <Link className="bf-btn bf-btn-p bf-btn-sm" href="/signup">
          {t.nav.start}
        </Link>
      </div>
    </header>
  );
}
