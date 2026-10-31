import { BackgroundFX } from "@/components/marketing/background-fx";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bf">
      <BackgroundFX />
      <div className="in">
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
