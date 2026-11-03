"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { NAV_ITEMS, type NavLabels } from "./sidebar-nav";

const PRIMARY = new Set(["/dashboard", "/dashboard/appointments", "/dashboard/clients"]);

/**
 * Phones and tablets (< lg): Overview, Appointments, Clients and a "More"
 * sheet with the rest. A modal <dialog> gives focus trap and Esc for free.
 */
export function MobileTabBar({ isManager, labels, moreLabel, closeLabel }: { isManager: boolean; labels: NavLabels; moreLabel: string; closeLabel: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const sheet = useRef<HTMLDialogElement>(null);
  const items = NAV_ITEMS.filter((i) => isManager || !i.managerOnly);
  const primary = items.filter((i) => PRIMARY.has(i.href));
  const more = items.filter((i) => !PRIMARY.has(i.href));
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const moreActive = more.some((i) => isActive(i.href));

  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  const tab = "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-medium";
  return (
    <nav aria-label={t.dashboardNav} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-lg gap-1">
        {primary.map(({ href, key, icon: Icon }) => (
          <li key={href} className="flex flex-1">
            <Link href={href} aria-current={isActive(href) ? "page" : undefined} className={`${tab} ${isActive(href) ? "text-accent" : "text-muted"}`}>
              <Icon aria-hidden className="size-5" />
              {labels[key]}
            </Link>
          </li>
        ))}
        <li className="flex flex-1">
          <button type="button" onClick={() => sheet.current?.showModal()} aria-haspopup="dialog" className={`${tab} ${moreActive ? "text-accent" : "text-muted"}`}>
            <MoreHorizontal aria-hidden className="size-5" />
            {moreLabel}
          </button>
        </li>
      </ul>
      <dialog
        ref={sheet}
        aria-label={moreLabel}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="mt-auto mb-0 w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="font-semibold">{moreLabel}</p>
          <button type="button" onClick={() => sheet.current?.close()} aria-label={closeLabel} className="flex size-11 items-center justify-center rounded-2xl hover:bg-canvas" autoFocus>
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <ul className="grid gap-1 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {more.map(({ href, key, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-medium ${isActive(href) ? "bg-brand text-on-brand" : "hover:bg-canvas"}`}
              >
                <Icon aria-hidden className="size-5" />
                {labels[key]}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </nav>
  );
}
