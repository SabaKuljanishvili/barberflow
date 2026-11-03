"use client";

import { useEffect, useRef } from "react";

/** On phones (< 768px) opening one question closes the others. Desktop keeps independent rows. */
export function FaqAccordion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const narrow = window.matchMedia("(max-width: 767px)");
    // "toggle" doesn't bubble, so listen in the capture phase.
    const onToggle = (e: Event) => {
      const opened = e.target;
      if (!narrow.matches || !(opened instanceof HTMLDetailsElement) || !opened.open) return;
      root.querySelectorAll("details[open]").forEach((d) => {
        if (d !== opened) (d as HTMLDetailsElement).open = false;
      });
    };
    root.addEventListener("toggle", onToggle, true);
    return () => root.removeEventListener("toggle", onToggle, true);
  }, []);
  return (
    <div ref={ref} className="faq-list">
      {children}
    </div>
  );
}
