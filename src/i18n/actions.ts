"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "./config";

/** Stores the chosen site language and re-renders the current page in it. */
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  refresh();
}
