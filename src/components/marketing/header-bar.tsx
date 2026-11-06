"use client";

import { useEffect, useRef } from "react";

/**
 * Sticky wrapper of the floating header. Once the page has scrolled more than
 * 8px it sets data-scrolled, and landing.css moves the bar from 24px to 12px
 * below the top (200ms; no transition under prefers-reduced-motion).
 */
export function HeaderBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div ref={ref} className="bf-header-bar">
      {children}
    </div>
  );
}
