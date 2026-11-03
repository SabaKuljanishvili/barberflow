"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "@/i18n/client";
import { localizedPath } from "@/i18n/routing";

/**
 * next/link that keeps marketing links in the page's language ("/contact"
 * becomes "/en/contact" on English pages). Other paths pass through.
 */
export default function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const { locale } = useI18n();
  return <Link href={typeof href === "string" ? localizedPath(locale, href) : href} {...rest} />;
}
