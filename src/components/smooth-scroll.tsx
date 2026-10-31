"use client";

import { useEffect } from "react";

/** True when `el` or an ancestor can still scroll by `dy` on its own. */
function innerScroller(el: Element | null, dy: number) {
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    }
  }
  return false;
}

/**
 * Inertia scrolling for the mouse wheel (touch stays native) and smooth
 * same-page anchor links. A small lerp on window scroll, so position: sticky
 * keeps working. Off under prefers-reduced-motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sc = document.scrollingElement ?? document.documentElement;
    let target = sc.scrollTop;
    let cur = target;
    let anim = 0;
    let ease = 0.1;

    function run(e = 0.1) {
      ease = e;
      if (anim) return;
      const step = () => {
        cur += (target - cur) * ease;
        if (Math.abs(target - cur) < 0.5) {
          cur = target;
          sc.scrollTop = cur;
          anim = 0;
          return;
        }
        sc.scrollTop = cur;
        anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function onWheel(e: WheelEvent) {
      if (reduce || e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = sc.scrollHeight - sc.clientHeight;
      if (max <= 1) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= sc.clientHeight;
      if (innerScroller(e.target as Element, dy)) return;
      if (!anim) target = cur = sc.scrollTop;
      const next = Math.max(0, Math.min(max, target + dy));
      if (next === target && (next === 0 || next === max)) return;
      e.preventDefault();
      target = next;
      run();
    }

    // Capture phase: same-page hash links glide here instead of jumping
    // through the router. Links to other pages are left alone.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href*='#']");
      if (!(a instanceof HTMLAnchorElement) || a.target) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      e.preventDefault();
      e.stopPropagation();
      const max = sc.scrollHeight - sc.clientHeight;
      if (!anim) target = cur = sc.scrollTop;
      target = Math.max(0, Math.min(max, el ? el.getBoundingClientRect().top + sc.scrollTop - 24 : 0));
      // Keeps the skip link working: focus follows the jump.
      if (el?.hasAttribute("tabindex")) el.focus({ preventScroll: true });
      if (reduce) {
        sc.scrollTop = target;
        return;
      }
      run(0.075);
    }

    function onScroll() {
      if (!anim) target = cur = sc.scrollTop;
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
