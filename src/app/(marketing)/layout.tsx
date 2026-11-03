import { BackgroundFX } from "@/components/marketing/background-fx";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/smooth-scroll";

// #smooth-wrapper > #smooth-content is the structure GSAP ScrollSmoother
// needs. Keep position: fixed UI outside it (it lives in the root layout).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <div id="smooth-wrapper">
        <div id="smooth-content">
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
        </div>
      </div>
    </>
  );
}
