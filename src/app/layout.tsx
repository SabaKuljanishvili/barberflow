import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Georgian, Noto_Serif, Noto_Serif_Georgian } from "next/font/google";
import { connection } from "next/server";
import { CookieBanner } from "@/components/cookie-banner";
import { I18nProvider } from "@/i18n/client";
import { OG_LOCALE } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/env";
import { site } from "@/lib/site";
import "./globals.css";

// Latin faces come first; they have no Georgian glyphs, so Georgian text
// falls through to the Noto Georgian families.
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const georgian = Noto_Sans_Georgian({
  subsets: ["georgian"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-georgian",
  display: "swap",
});
const serif = Noto_Serif({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-noto-serif", display: "swap" });
// Also the home hero headline and the header logo (--font-hero in tokens.css),
// which use it for Latin text too. display: swap plus next/font's automatic
// size-adjusted fallback keep the swap free of layout shift.
const serifGeorgian = Noto_Serif_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif-georgian",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const title = `${site.name} | ${t.meta.tagline}`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s | ${site.name}` },
    description: t.meta.description,
    applicationName: site.name,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter((l) => l !== OG_LOCALE[locale]),
      title,
      description: t.meta.description,
    },
    twitter: { card: "summary_large_image", title: site.name, description: t.meta.description },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

// Dark only; the colour matches --bg in tokens.css.
export const viewport: Viewport = {
  themeColor: "#131414",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The CSP nonce is per request, so every page must render dynamically.
  await connection();
  const { locale, t } = await getI18n();
  return (
    // Dark only. The background is inline (same value as --bg) so the very
    // first paint is dark, before any stylesheet has arrived.
    <html
      lang={locale}
      className={`${manrope.variable} ${georgian.variable} ${serif.variable} ${serifGeorgian.variable}`}
      style={{ backgroundColor: "#131414", colorScheme: "dark" }}
    >
      <body className="min-h-dvh bg-canvas text-ink">
        <I18nProvider locale={locale} messages={t.client}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-2xl focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
          >
            {t.meta.skipToContent}
          </a>
          {children}
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
