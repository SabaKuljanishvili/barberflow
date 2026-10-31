import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.notFound.title, description: t.notFound.description, robots: { index: false } };
}

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="flex items-center gap-3">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="card mt-8 max-w-md p-10">
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
  );
}
