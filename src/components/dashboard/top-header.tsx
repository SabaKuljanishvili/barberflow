import Link from "next/link";
import { Bell, ChevronDown, Search } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { StaffRole } from "@/lib/supabase/database.types";
import { formatInZone } from "@/lib/time";

type Pending = { id: string; appointment_time: string; client: string };

export async function TopHeader({
  fullName,
  email,
  role,
  timezone,
  pending,
}: {
  fullName: string;
  email: string;
  role: StaffRole;
  timezone: string;
  pending: Pending[];
}) {
  const { locale, t } = await getI18n();
  const h = t.dashboard.header;
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    // Georgian has no case; toUpperCase() would switch it to Mtavruli.
    .replace(/\P{Script=Georgian}/gu, (c) => c.toUpperCase());

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3 shadow-soft">
      <form action="/dashboard/clients" method="get" role="search" className="relative min-w-0 flex-1">
        <label htmlFor="global-search" className="sr-only">
          {h.searchLabel}
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input
          id="global-search"
          name="q"
          type="search"
          placeholder={h.searchPlaceholder}
          maxLength={60}
          className="input bg-canvas pl-11"
        />
      </form>

      <LocaleSwitcher />

      <details className="relative">
        <summary
          className="relative flex size-11 cursor-pointer list-none items-center justify-center rounded-2xl border border-line hover:bg-canvas"
          aria-label={fmt(h.notifications, { count: pending.length })}
        >
          <Bell aria-hidden className="size-5 text-ink" />
          {pending.length > 0 && (
            <span aria-hidden className="absolute top-2 right-2 size-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
          )}
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-3xl border border-line bg-surface p-4 shadow-soft">
          <h2 className="text-sm font-semibold">{h.awaiting}</h2>
          {pending.length ? (
            <ul className="mt-2 divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <span className="font-medium">{p.client}</span>
                  <span className="block text-muted">{formatInZone(p.appointment_time, timezone, {}, INTL_LOCALE[locale])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{h.caughtUp}</p>
          )}
          <Link href="/dashboard/appointments?status=pending" className="mt-3 inline-block text-sm font-medium text-brand-700">
            {h.viewPending}
          </Link>
        </div>
      </details>

      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-line py-1.5 pr-3 pl-1.5 hover:bg-canvas">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-900"
          >
            {initials}
          </span>
          <span className="hidden text-left text-sm sm:block">
            <span className="block font-medium leading-tight">{fullName}</span>
            <span className="block text-xs text-muted">{t.roles[role]}</span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted" />
          <span className="sr-only">{h.profileMenu}</span>
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-3xl border border-line bg-surface p-2 shadow-soft">
          <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
          <Link href="/dashboard/account" className="block rounded-2xl px-3 py-2 text-sm hover:bg-canvas">
            {h.account}
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="block w-full rounded-2xl px-3 py-2 text-left text-sm text-danger hover:bg-red-50">
              {h.signOut}
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
