import Link from "@/components/locale-link";
import { getI18n } from "@/i18n/server";
import { AmbientSpot } from "./ambient-spot";
import { isoDateIn, ribbonCards } from "./demo-bookings";

/**
 * Home hero: eyebrow chip, two-line serif headline (line 2 italic accent with
 * an inline mini waveform), sub text and CTAs, then two crossing marquee
 * ribbons, over two drifting ambient spots. Server component; every animation
 * is CSS (landing.css, `.hx` and `.amb`). No shadows.
 */
export async function Hero() {
  const { locale, t } = await getI18n();
  const h = t.home;
  // "Today" for the demo booking dates, in the shops' time zone.
  const cards = ribbonCards(h.ribbons, isoDateIn("Asia/Tbilisi"), locale);
  // Each half of a marquee track holds the list twice, so one half is wider
  // than any screen and translateX(±50%) loops without a seam.
  const half = <T,>(list: readonly T[]) => [...list, ...list];

  return (
    <section id="top" className="hx" aria-labelledby="hero-title">
      <AmbientSpot color="green" size={820} opacity={0.34} duration={20} right={-380} top={-260} />
      <AmbientSpot color="mint" size={620} opacity={0.08} duration={26} left={-260} top={420} desktopOnly />

      <div className="hx-in">
        <span className="hx-eyebrow">
          <i aria-hidden="true" />
          {h.eyebrow}
        </span>
        <h1 id="hero-title" className="hx-title">
          <span className="hx-l1">{h.titleBefore}</span>{" "}
          <span className="hx-l2">
            <em>{h.titleAccent}</em>
            <span className="hx-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
        </h1>
        <div className="hx-row">
          <p className="hx-sub">{h.lede}</p>
          <div className="hx-ctas">
            <Link className="hx-btn hx-btn-p" href="/signup">
              {h.ctaPrimary}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            {/* Same-page anchor to the call sample section; the smooth scroll
                comes from scroll-behavior (off under reduced motion). */}
            <a className="hx-btn hx-btn-g" href="#sample">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {h.ctaSecondary}
            </a>
          </div>
        </div>
      </div>

      <div className="hx-ribbons" aria-hidden="true">
        <div className="hx-rib hx-rib-g">
          <div className="hx-track hx-track-r">
            {[0, 1].map((copy) =>
              half(h.ribbons.words).map((word, i) => (
                <span key={`${copy}-${i}`} className="hx-word">
                  {word}
                  <i />
                </span>
              )),
            )}
          </div>
        </div>
        <div className="hx-rib hx-rib-d">
          <div className="hx-track hx-track-l">
            {[0, 1].map((copy) =>
              half(cards).map((card, i) => (
                <span key={`${copy}-${i}`} className="hx-card">
                  <span className="hx-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </span>
                  <span className="hx-card-text">
                    <b>{card.what}</b>
                    <span>{card.when}</span>
                  </span>
                  <span className="hx-time">{card.time}</span>
                </span>
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
