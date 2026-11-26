"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, MoreVertical } from "lucide-react";
import { fmt } from "@/i18n/config";
import { STATUSES } from "@/lib/appointments-ui";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import type { Labels, StatusNames } from "./types";

/** Status colour tokens; the label always goes with it (never colour alone). */
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  pending: "var(--ap-pending)",
  confirmed: "var(--green-ink)",
  completed: "var(--ap-muted)",
  no_show: "var(--ap-noshow)",
  cancelled: "var(--danger)",
};

export function toneStyle(status: AppointmentStatus, alpha = 12): React.CSSProperties {
  const c = STATUS_TONE[status];
  return { color: c, background: `color-mix(in srgb, ${c} ${alpha}%, transparent)` };
}

/**
 * A menu drawn in a fixed layer under (or above) its button, so scrolling
 * containers never clip it. Closes on outside click, scroll and resize.
 */
function useFloating(open: boolean, close: () => void, width: number) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !trigger.current) {
      setPos(null);
      return;
    }
    const r = trigger.current.getBoundingClientRect();
    const height = panel.current?.offsetHeight ?? 240;
    const below = r.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - 6 - height) : below;
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const onMove = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close]);

  return { trigger, panel, pos };
}

/** Moves focus between `[data-item]` children with the arrow keys, Home and End. */
function arrowNav(e: React.KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-item]")];
  const i = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (e.key === "ArrowDown") next = (i + 1) % items.length;
  else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  if (next < 0) return false;
  e.preventDefault();
  items[next]?.focus();
  return true;
}

/**
 * The one status control: a coloured pill (dot, label, chevron). It opens a
 * listbox of every status; picking one saves at once. Read-only for
 * bookings the user may not change.
 */
export function StatusMenu({
  status,
  onChange,
  canEdit,
  who,
  labels: p,
  names,
}: {
  status: AppointmentStatus;
  onChange: (s: AppointmentStatus) => void;
  canEdit: boolean;
  who: string;
  labels: Labels;
  names: StatusNames;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { trigger, panel, pos } = useFloating(open, close, 210);
  const listId = useId();

  useEffect(() => {
    if (open && pos) panel.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open, pos, panel]);

  const pill = "inline-flex h-10 items-center gap-[7px] rounded-full px-3 text-xs font-bold whitespace-nowrap";
  const dot = <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: STATUS_TONE[status] }} />;
  if (!canEdit) {
    return (
      <span className={pill} style={toneStyle(status)}>
        {dot}
        {names[status]}
      </span>
    );
  }

  function pick(s: AppointmentStatus) {
    setOpen(false);
    trigger.current?.focus();
    if (s !== status) onChange(s);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={fmt(p.changeStatus, { name: who, status: names[status] })}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${pill} hover:brightness-110`}
        style={toneStyle(status)}
      >
        {dot}
        {names[status]}
        <ChevronDown aria-hidden className="size-3" strokeWidth={2.6} />
      </button>
      {open && (
        <div
          ref={panel}
          id={listId}
          role="listbox"
          aria-label={p.statusMenu}
          tabIndex={-1}
          className="fixed z-[60] w-[210px] rounded-[14px] border border-ap-drawer-line bg-ap-card p-1.5 shadow-[var(--ap-drawer-shadow)]"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          onKeyDown={(e) => {
            if (arrowNav(e)) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
            } else if (e.key === "Tab") setOpen(false);
          }}
        >
          {STATUSES.map((s) => (
            <div
              key={s}
              role="option"
              data-item
              tabIndex={-1}
              aria-selected={s === status}
              onClick={() => pick(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(s);
                }
              }}
              className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-ap-ink2 outline-none hover:bg-ap-row focus-visible:bg-ap-row focus-visible:outline-2 focus-visible:outline-offset-0"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: STATUS_TONE[s] }} />
              <span className="flex-1">{names[s]}</span>
              {s === status && <Check aria-hidden className="size-4 text-accent" />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** "⋯" menu of a list row: reschedule, open the client, cancel (with a confirm step). */
export function RowMenu({
  who,
  clientHref,
  canEdit,
  canReschedule,
  canCancel,
  onReschedule,
  onCancel,
  labels: p,
}: {
  who: string;
  clientHref: string;
  canEdit: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  const { trigger, panel, pos } = useFloating(open, close, 220);
  const menuId = useId();

  useEffect(() => {
    if (open && pos) panel.current?.querySelector<HTMLElement>("[data-item]")?.focus();
  }, [open, pos, confirming, panel]);

  const item = "flex h-10 w-full items-center rounded-[10px] px-2.5 text-left text-[13px] font-semibold outline-none hover:bg-ap-row focus-visible:bg-ap-row focus-visible:outline-2 focus-visible:outline-offset-0";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={fmt(p.moreActions, { name: who })}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex size-10 items-center justify-center rounded-[10px] text-ap-muted hover:bg-ap-line hover:text-ap-ink"
      >
        <MoreVertical aria-hidden className="size-[18px]" />
      </button>
      {open && (
        <div
          ref={panel}
          id={menuId}
          role="menu"
          aria-label={fmt(p.moreActions, { name: who })}
          className="fixed z-[60] w-[220px] rounded-[14px] border border-ap-drawer-line bg-ap-card p-1.5 shadow-[var(--ap-drawer-shadow)]"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          onKeyDown={(e) => {
            if (arrowNav(e)) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
              trigger.current?.focus();
            } else if (e.key === "Tab") close();
          }}
        >
          {confirming ? (
            <div className="p-1.5">
              <p className="mb-2 text-[13px] font-semibold text-ap-ink">{p.cancelConfirm}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  role="menuitem"
                  data-item
                  className={`${item} justify-center bg-danger-soft text-danger`}
                  onClick={() => {
                    close();
                    onCancel();
                  }}
                >
                  {p.cancelYes}
                </button>
                <button type="button" role="menuitem" data-item className={`${item} justify-center text-ap-ink2`} onClick={() => setConfirming(false)}>
                  {p.keep}
                </button>
              </div>
            </div>
          ) : (
            <>
              {canEdit && canReschedule && (
                <button
                  type="button"
                  role="menuitem"
                  data-item
                  className={`${item} text-ap-ink2`}
                  onClick={() => {
                    close();
                    onReschedule();
                  }}
                >
                  {p.reschedule}
                </button>
              )}
              <Link href={clientHref} role="menuitem" data-item className={`${item} text-ap-ink2`}>
                {p.openClientShort}
              </Link>
              {canEdit && canCancel && (
                <button type="button" role="menuitem" data-item className={`${item} text-danger`} onClick={() => setConfirming(true)}>
                  {p.cancelBooking}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
