import Link from "next/link";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";

export function ScissorsIcon({ size = 17 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

export async function Logo({ href = "/" }: { href?: string }) {
  const { t } = await getI18n();
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-2xl" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
      <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
        <ScissorsIcon />
      </span>
      <span className="font-serif text-[19px] font-semibold tracking-tight text-ink">{site.name}</span>
    </Link>
  );
}
