"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/locale-link";
import { splitLocalePath } from "@/i18n/routing";

type Item = { href: string; label: string };

/** Header links; the one for the current page is highlighted and marked aria-current. */
export function NavLinks({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname() ?? "/";
  // "/en/pricing" and "/pricing" are the same page.
  const path = splitLocalePath(pathname)?.path ?? pathname;
  return (
    <nav className="navlinks" aria-label={label}>
      {items.map((item) => {
        const current = item.href === path;
        return (
          <Link key={item.href} className="navlink" href={item.href} aria-current={current ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
