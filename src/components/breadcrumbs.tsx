import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteUrl } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import { JsonLd } from "./json-ld";

export type Crumb = { href: string; label: string };

export async function Breadcrumbs({ items, structured = true }: { items: Crumb[]; structured?: boolean }) {
  const { t } = await getI18n();
  return (
    <>
      <nav aria-label={t.nav.breadcrumb} className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="font-medium text-ink">
                    {item.label}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className="rounded-lg hover:text-accent">
                      {item.label}
                    </Link>
                    <ChevronRight aria-hidden className="size-4" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {structured && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.label,
              item: `${siteUrl()}${item.href}`,
            })),
          }}
        />
      )}
    </>
  );
}
