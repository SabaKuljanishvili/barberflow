import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Georgian } from "next/font/google";
import { connection } from "next/server";
import { CookieBanner } from "@/components/cookie-banner";
import { I18nProvider } from "@/i18n/client";
import { OG_LOCALE } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/env";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Inter has no Georgian glyphs; the font stack falls through to this for them.
const georgian = Noto_Sans_Georgian({ subsets: ["georgian"], variable: "--font-georgian", display: "swap" });

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
      url: "/",
      title,
      description: t.meta.description,
    },
    twitter: { card: "summary_large_image", title: site.name, description: t.meta.description },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#064E3B",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The CSP nonce is per request, so every page must render dynamically.
  await connection();
  const { locale, t } = await getI18n();
  return (
    <html lang={locale} className={`${inter.variable} ${georgian.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink">
        <I18nProvider locale={locale} messages={t.client}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-2xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
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
