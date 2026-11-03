import Image from "next/image";
import Link from "next/link";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { BRAND_MARK_SRC, site } from "@/lib/site";

/** Brand mark (transparent star). Decorative: the brand name always sits next to it. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      src={BRAND_MARK_SRC}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export async function Logo({ href = "/" }: { href?: string }) {
  const { t } = await getI18n();
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-2xl" aria-label={fmt(t.meta.logoHome, { site: site.name })}>
      <BrandMark />
      <span className="font-serif text-[19px] font-semibold tracking-tight text-ink">{site.name}</span>
    </Link>
  );
}
