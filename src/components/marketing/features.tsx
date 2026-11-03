"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { SCENES } from "./scenes";

type Home = Dictionary["home"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Scroll-synced features: the list item nearest the viewport's centre is
 * active, and the pinned visual on the left plays its scene.
 */
export function Features({ home }: { home: Home }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = Array.from(listRef.current?.children ?? []);
    let raf = 0;
    function sync() {
      raf = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestD = Infinity;
      items.forEach((el, k) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      setActive(best);
      pin();
    }
    // Desktop layout, written straight to the DOM (React never sets these):
    // - once the section is in the upper half of the screen the heading
    //   shrinks (data-compact), leaving room for the card;
    // - the pinned card is centred on the viewport, so it sits level with the
    //   active number (the active item is the one nearest the centre);
    // - the list is offset so every number, first and last included, lines
    //   up with the card's centre.
    let compactHead = 0;
    function measure() {
      const stick = stickRef.current;
      const head = headRef.current;
      const h2 = head?.querySelector("h2");
      if (!stick || !head || !h2) return;
      const was = stick.hasAttribute("data-compact");
      h2.style.transition = "none";
      stick.setAttribute("data-compact", "");
      compactHead = head.offsetHeight;
      stick.toggleAttribute("data-compact", was);
      void head.offsetHeight;
      h2.style.transition = "";
    }
    function pin() {
      const split = splitRef.current;
      const stick = stickRef.current;
      const viz = vizRef.current;
      const list = listRef.current;
      const first = list?.firstElementChild as HTMLElement | null;
      const last = list?.lastElementChild as HTMLElement | null;
      if (!split || !stick || !viz || !list || !first || !last) return;
      const desktop = window.innerWidth > 960;
      const vh = window.innerHeight;
      const card = viz.offsetHeight;
      stick.toggleAttribute("data-compact", desktop && split.getBoundingClientRect().top < vh * 0.45);
      stick.style.setProperty("--stick-top", `${Math.max(16, Math.round(vh / 2 - compactHead - card / 2))}px`);
      list.style.marginTop = desktop ? `${Math.max(0, Math.round(compactHead + card / 2 - first.offsetHeight / 2))}px` : "";
      list.style.paddingBottom = desktop ? `${Math.max(0, Math.round(card / 2 - last.offsetHeight / 2))}px` : "";
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    onResize();
    // Web fonts change the heading's height.
    document.fonts?.ready.then(onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const Scene = SCENES[active];
  const total = home.features.length;

  return (
    <section id="features" className="wrap bf-cb sec">
      <div ref={splitRef} className="split">
        <div ref={stickRef} className="stick">
          <div ref={headRef} className="stick-head">
            <span className="eyebrow">{home.featuresEyebrow}</span>
            <h2 className="serif h2">{home.featuresTitle}</h2>
          </div>
          <div ref={vizRef} className="bf-card viz" aria-live="polite">
            <div className="vizhead">
              <span className="vnum">
                {pad(active + 1)} <span>/ {pad(total)}</span>
              </span>
              <span className="prog" aria-hidden="true">
                {home.features.map((f, k) => (
                  <i key={f.title} className={k === active ? "on" : undefined} />
                ))}
              </span>
            </div>
            <div className="stage">
              <Scene key={active} t={home.scenes} />
            </div>
            <div key={active} className="cap">
              <i />
              <span>{home.features[active].label}</span>
            </div>
          </div>
        </div>

        <div ref={listRef} className="list">
          {home.features.map((f, k) => (
            <div key={f.title} className={`item ${k === active ? "on" : ""}`}>
              <span className="idx">{pad(k + 1)}</span>
              <div className="fade">
                <h3 className="it">{f.title}</h3>
                <p className="id">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
