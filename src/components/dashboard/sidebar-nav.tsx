"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, Scissors, Settings, UserRound, Users, Contact } from "lucide-react";
import { useI18n } from "@/i18n/client";

const items = [
  { href: "/dashboard", key: "overview", icon: LayoutGrid, managerOnly: false },
  { href: "/dashboard/appointments", key: "appointments", icon: CalendarDays, managerOnly: false },
  { href: "/dashboard/clients", key: "clients", icon: Contact, managerOnly: false },
  { href: "/dashboard/services", key: "services", icon: Scissors, managerOnly: true },
  { href: "/dashboard/team", key: "team", icon: Users, managerOnly: true },
  { href: "/dashboard/settings", key: "settings", icon: Settings, managerOnly: true },
  { href: "/dashboard/account", key: "account", icon: UserRound, managerOnly: false },
] as const;

/** Instant click feedback while the next page is still on its way (slow networks). */
function PendingDot() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`ml-auto size-1.5 rounded-full bg-current transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} />;
}

export type NavLabels = Record<(typeof items)[number]["key"], string>;

export function SidebarNav({ isManager, labels }: { isManager: boolean; labels: NavLabels }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav aria-label={t.dashboardNav}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items
          .filter((i) => isManager || !i.managerOnly)
          .map(({ href, key, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-brand text-on-brand shadow-soft" : "text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden className="size-[18px]" />
                  {labels[key]}
                  <PendingDot />
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
