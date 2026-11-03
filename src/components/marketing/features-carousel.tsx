"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmt } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { SCENES } from "./scenes";

type Home = Dictionary["home"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Phones (< 768px): the features as a horizontal scroll-snap carousel, one
 * 300px card each with the next card peeking in. Native scrolling (swipe,
 * keyboard, screen readers); the dots and arrows only call scrollTo.
 * The desktop sticky showcase (features.tsx) is hidden at this width.
 */
export function FeaturesCarousel({ home }: { home: Home }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = home.features.length;
  const c = home.carousel;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const first = el.firstElementChild as HTMLElement | null;
        if (!first) return;
        const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
        setActive(Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / step))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [total]);

  function go(i: number) {
    const el = track.current;
    const card = el?.children[Math.max(0, Math.min(total - 1, i))] as HTMLElement | undefined;
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section className="wrap bf-cb sec m-only fcar" aria-labelledby="features-m-title" aria-roledescription="carousel">
      <div className="sec-head">
        <span className="eyebrow">{home.featuresEyebrow}</span>
        <h2 id="features-m-title" className="serif h2">
          {home.featuresTitle}
        </h2>
      </div>
      <div ref={track} className="fc-track" aria-label={c.label}>
        {home.features.map((f, k) => {
          const Scene = SCENES[k];
          return (
            <article key={f.title} className="bf-card fc-card" aria-roledescription="slide" aria-label={fmt(c.slide, { n: k + 1, total })}>
              <span className="vnum fc-num">
                {pad(k + 1)} <span>/ {pad(total)}</span>
              </span>
              <div className="stage fc-stage" aria-hidden="true">
                <Scene t={home.scenes} />
              </div>
              <h3 className="it">{f.title}</h3>
              <p className="id">{f.body}</p>
            </article>
          );
        })}
      </div>
      <div className="fc-nav">
        <button type="button" className="fc-arrow" onClick={() => go(active - 1)} disabled={active === 0} aria-label={c.prev}>
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <div className="fc-dots" aria-hidden="true">
          {home.features.map((f, k) => (
            <span key={f.title} className="fc-dot" aria-current={k === active ? "true" : undefined}>
              <i />
            </span>
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          {fmt(c.slide, { n: active + 1, total })}
        </span>
        <button type="button" className="fc-arrow" onClick={() => go(active + 1)} disabled={active === total - 1} aria-label={c.next}>
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </section>
  );
}
