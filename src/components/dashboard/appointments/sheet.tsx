"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-side slide-over (full screen under 768px). Closes on the backdrop,
 * Esc and the X button; keeps focus inside while open and gives it back to
 * whatever opened it. The page behind does not scroll.
 */
export function Sheet({
  open,
  onClose,
  label,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const first = dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // An open menu inside the sheet closes first.
        if (e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="ap-fade absolute inset-0 bg-ap-backdrop" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="ap-slide absolute inset-0 flex flex-col bg-ap-card text-ap-ink md:inset-y-3 md:right-3 md:left-auto md:w-[460px] md:rounded-[22px] md:border md:border-ap-drawer-line md:shadow-[var(--ap-drawer-shadow)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ap-line px-[22px] pt-5 pb-3.5">
          <h2 className="text-lg font-bold">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-10 items-center justify-center rounded-[10px] border border-ap-line2 bg-ap-bg text-ap-ink hover:border-ap-chip-line"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">{children}</div>
        {footer && <div className="border-t border-ap-line px-[22px] pt-4 pb-5">{footer}</div>}
      </div>
    </div>
  );
}
