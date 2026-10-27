import Link from "next/link";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getI18n } from "@/i18n/server";
import { marketingNav } from "@/lib/site";

export async function SiteHeader() {
  const { t } = await getI18n();
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label={t.nav.main}>
          <ul className="flex flex-wrap items-center gap-1 text-sm font-medium">
            {marketingNav.map((item) => (
              <li key={item.href} className="hidden md:block">
                <Link href={item.href} className="rounded-2xl px-3 py-2 text-muted hover:bg-canvas hover:text-ink">
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
            <li>
              <LocaleSwitcher className="mr-1" />
            </li>
            <li>
              <Link href="/login" className="rounded-2xl px-3 py-2 text-ink hover:bg-canvas">
                {t.nav.signIn}
              </Link>
            </li>
            <li>
              <Link href="/signup" className="btn-primary">
                {t.nav.setUpShop}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
