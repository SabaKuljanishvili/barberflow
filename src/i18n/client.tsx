"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

type ClientMessages = Dictionary["client"];

// Only the `client` slice of the dictionary crosses to the browser; the root
// layout provides it.
const I18nContext = createContext<{ locale: Locale; t: ClientMessages } | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: ClientMessages; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: messages }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
