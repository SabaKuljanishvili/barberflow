"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, isLocale } from "./config";
import { isMarketingPath, localizedPath, splitLocalePath } from "./routing";

/**
 * Stores the chosen site language. On a marketing page (its language is in
 * the URL) it moves to the same page in the other language; elsewhere it
 * re-renders the current page.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const current = formData.get("path");
  if (typeof current === "string" && current.startsWith("/") && !current.startsWith("//")) {
    const [pathname, hash = ""] = current.split("#");
    const page = splitLocalePath(pathname)?.path ?? pathname;
    if (isMarketingPath(page)) redirect(localizedPath(locale, page) + (hash && /^[\w-]+$/.test(hash) ? `#${hash}` : ""));
  }
  refresh();
}
