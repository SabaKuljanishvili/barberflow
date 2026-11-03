import { BackgroundFX } from "@/components/marketing/background-fx";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// Native scrolling only (CSS scroll-behavior in landing.css). The old
// transform-based smoother desynced window.scrollY from what was on screen
// and broke keyboard scrolling, anchors, find-in-page and screen readers.
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
