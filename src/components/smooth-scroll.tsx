"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SMOOTH_SCROLL_EVENT, STICKY_ATTR, stickyShift } from "./smooth-scroll-shared";

const WRAPPER = "#smooth-wrapper";
const CONTENT = "#smooth-content";
const ANCHOR_OFFSET = "top 24px";

/**
 * Emulates `position: sticky` for [data-smooth-sticky] elements: ScrollSmoother
 * moves the content with a transform, which native sticky ignores. Reads every
 * element first, then writes, once per smoothed frame.
 */
function syncSticky() {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[${STICKY_ATTR}]`));
  const shifts = els.map((el) => {
    const cs = getComputedStyle(el);
    const parent = el.parentElement;
    if (cs.position !== "sticky" || !parent) return 0; // e.g. below its breakpoint
    const prev = Number(el.dataset.stickyY ?? 0);
    const layoutTop = el.getBoundingClientRect().top - prev;
    const pcs = getComputedStyle(parent);
    const limit = parent.getBoundingClientRect().bottom - parseFloat(pcs.paddingBottom) - parseFloat(pcs.borderBottomWidth);
    return stickyShift(parseFloat(cs.top) || 0, layoutTop, el.offsetHeight, limit);
  });
  els.forEach((el, k) => {
    const y = Math.round(shifts[k] * 100) / 100;
    if (Number(el.dataset.stickyY ?? 0) === y) return;
    el.dataset.stickyY = String(y);
    el.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
  });
}

function resetSticky() {
  document.querySelectorAll<HTMLElement>(`[${STICKY_ATTR}]`).forEach((el) => {
    delete el.dataset.stickyY;
    el.style.transform = "";
  });
}

/**
 * CSS scroll-driven reveals (`animation-timeline: view()` in landing.css) bind
 * to the nearest scroll container, which under ScrollSmoother is the wrapper
 * that never scrolls. While smoothing, the same ranges run on ScrollTrigger.
 * Only where the browser supports view() timelines, to keep parity.
 */
function buildReveals() {
  if (typeof CSS === "undefined" || !CSS.supports("animation-timeline: view()")) return null;
  return gsap.context(() => {
    // .sr: rise, entry 5% -> entry 45%.
    gsap.utils.toArray<HTMLElement>(".bf .sr").forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: () => `top bottom-=${el.offsetHeight * 0.05}`,
            end: () => `top bottom-=${el.offsetHeight * 0.45}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    });
    // .track i: draw, entry 20% -> cover 45%.
    gsap.utils.toArray<HTMLElement>(".bf .track i").forEach((el) => {
      gsap.fromTo(
        el,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: () => `top bottom-=${el.offsetHeight * 0.2}`,
            end: () => `top bottom-=${(window.innerHeight + el.offsetHeight) * 0.45}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    });
  });
}

/**
 * GSAP ScrollSmoother for the marketing site. Needs #smooth-wrapper >
 * #smooth-content around the page (app/(marketing)/layout.tsx). Off under
 * prefers-reduced-motion (native scrolling; sticky and CSS reveals work as is).
 * Fixed-position UI (cookie banner, skip link) must stay outside the wrapper.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  const reveals = useRef<gsap.Context | null>(null);
  const popped = useRef(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const html = document.documentElement;
      const smoother = ScrollSmoother.create({
        wrapper: WRAPPER,
        content: CONTENT,
        smooth: 1.5,
        effects: true,
        onUpdate: () => {
          syncSticky();
          window.dispatchEvent(new Event(SMOOTH_SCROLL_EVENT));
        },
      });
      html.classList.add("bf-smooth");
      reveals.current = buildReveals();
      ScrollTrigger.addEventListener("refresh", syncSticky);
      ScrollTrigger.refresh();

      // Capture phase: same-page hash links glide via the smoother instead of
      // jumping through the router. Links to other pages are left alone.
      function onClick(e: MouseEvent) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = (e.target as Element).closest?.("a[href*='#']");
        if (!(a instanceof HTMLAnchorElement) || a.target) return;
        const url = new URL(a.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
        const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        e.preventDefault();
        e.stopPropagation();
        if (el) smoother.scrollTo(el, true, ANCHOR_OFFSET);
        else smoother.scrollTo(0, true);
        // Keeps the skip link working: focus follows the jump.
        if (el?.hasAttribute("tabindex")) el.focus({ preventScroll: true });
      }
      const onPop = () => (popped.current = true);
      document.addEventListener("click", onClick, true);
      window.addEventListener("popstate", onPop);

      return () => {
        document.removeEventListener("click", onClick, true);
        window.removeEventListener("popstate", onPop);
        ScrollTrigger.removeEventListener("refresh", syncSticky);
        reveals.current?.revert();
        reveals.current = null;
        smoother.kill();
        resetSticky();
        html.classList.remove("bf-smooth");
      };
    });
    return () => mm.revert();
  }, []);

  // Client navigation between marketing pages: the smoother persists, but its
  // content was still transformed to the old page's scroll, so Next's own
  // scroll handling lands in the wrong place. Jump (no glide) to the top, the
  // hash target, or the restored position on back/forward.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const smoother = ScrollSmoother.get();
    if (!smoother) return;
    const wrapper = document.querySelector(WRAPPER);
    if (wrapper) wrapper.scrollTop = 0;
    reveals.current?.revert();
    reveals.current = buildReveals();
    ScrollTrigger.refresh();
    const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (el) smoother.scrollTo(el, false, ANCHOR_OFFSET);
    else smoother.scrollTop(popped.current ? window.scrollY : 0);
    popped.current = false;
    syncSticky();
  }, [pathname]);

  return null;
}
