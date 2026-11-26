import type { Metadata } from "next";
import Link from "@/components/locale-link";
import { BackgroundFX } from "@/components/marketing/background-fx";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.notFound.title, description: t.notFound.description, robots: { index: false } };
}

// Same shell as the marketing pages (floating header, footer).
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="bf">
      <BackgroundFX />
      <div className="in">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <div className="card max-w-md p-10">
            <p className="text-sm font-semibold text-accent">404</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.notFound.title}</h1>
            <p className="mt-3 text-muted">{t.notFound.body}</p>
            <nav aria-label={t.notFound.helpful} className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/" className="btn-primary">
                {t.notFound.home}
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                {t.notFound.dashboard}
              </Link>
            </nav>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
