import Link from "next/link";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { site } from "@/lib/site";

export async function LogoMark({ className = "size-9" }: { className?: string }) {
  const { t } = await getI18n();
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label={fmt(t.meta.logoAlt, { site: site.name })}>
      <rect width="32" height="32" rx="10" fill="#064E3B" />
      <path d="M10 8h3v16h-3zM19 8h3v16h-3z" fill="#10B981" />
      <path d="M8 13l16-4v3L8 16zM8 20l16-4v3L8 23z" fill="#fff" />
    </svg>
  );
}

export async function Logo({ href = "/" }: { href?: string }) {
  const { t } = await getI18n();
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-2xl" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-ink">{site.name}</span>
    </Link>
  );
}
