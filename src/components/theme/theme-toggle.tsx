"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

type Theme = "light" | "dark";

const THEME_KEY = "bf-theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

let animTimer: ReturnType<typeof setTimeout> | undefined;

function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-anim");
    clearTimeout(animTimer);
    animTimer = setTimeout(() => root.classList.remove("theme-anim"), 450);
  }
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

/**
 * Light/dark switch. The icons swap through CSS on <html data-theme>, so the
 * server markup is correct before hydration; only aria-pressed waits for it.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  return (
    <button
      type="button"
      className={`themebtn ${className}`}
      aria-label={t.theme.toggle}
      title={t.theme.toggle}
      aria-pressed={theme === "dark"}
      onClick={() => setTheme(readTheme() === "dark" ? "light" : "dark")}
    >
      <svg className="i-moon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg className="i-sun" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
