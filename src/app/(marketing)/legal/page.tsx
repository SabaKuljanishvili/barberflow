import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getI18n } from "@/i18n/server";
import { legalPages } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.legal.title, description: t.legal.description, alternates: { canonical: "/legal" } };
}

export default async function LegalIndex() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { href: "/legal", label: t.legal.title }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.legal.title}</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {legalPages.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="card block h-full hover:border-accent">
              <h2 className="text-lg font-semibold">{t.legal.pages[p.key].title}</h2>
              <p className="mt-2 text-sm text-muted">{t.legal.pages[p.key].summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
