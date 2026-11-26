"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { updateAppointmentStatus } from "@/app/dashboard/actions";
import { changeStatusOptimistic, statusReducer, type Prefill, type StatusOverrides } from "@/lib/appointments-ui";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { BookingDrawer, type Booked, type BookingData } from "./booking-drawer";
import { DetailsDrawer } from "./details-drawer";
import type { ApptVM, Labels, StatusNames } from "./types";

type Toast = { id: number; text: string; tone: "ok" | "error" };

type BoardCtx = {
  labels: Labels;
  names: StatusNames;
  isManager: boolean;
  userId: string;
  openBooking: (prefill?: Prefill) => void;
  openDetails: (a: ApptVM) => void;
  statusOf: (a: ApptVM) => AppointmentStatus;
  changeStatus: (a: ApptVM, s: AppointmentStatus) => void;
  isHighlighted: (a: ApptVM) => boolean;
};

const Ctx = createContext<BoardCtx | null>(null);

export function useBoard(): BoardCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBoard must be used inside <Board>");
  return v;
}

/**
 * Client shell of the Appointments page: owns the booking and details
 * drawers, optimistic status changes, toasts, the "just booked" highlight
 * and the N shortcut. The views read it through useBoard().
 */
export function Board({
  children,
  rows,
  detail,
  booking,
  initialBooking,
  labels,
  names,
}: {
  children: React.ReactNode;
  rows: ApptVM[];
  detail: ApptVM | null;
  booking: BookingData;
  initialBooking: Prefill | null;
  labels: Labels;
  names: StatusNames;
}) {
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(initialBooking !== null);
  const [prefill, setPrefill] = useState<Prefill>(initialBooking ?? {});
  const [openAppt, setOpenAppt] = useState<ApptVM | null>(detail);
  const [overrides, dispatch] = useReducer(statusReducer, {} as StatusOverrides);
  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [highlight, setHighlight] = useState<Booked | null>(null);

  // A deep link (?appt=) opened from another page; a refresh of the same one keeps it as is.
  const [seenDetail, setSeenDetail] = useState(detail?.id);
  if (detail?.id !== seenDetail) {
    setSeenDetail(detail?.id);
    if (detail) setOpenAppt(detail);
  }

  // Once fresh server data carries a status, drop the local override.
  useEffect(() => {
    for (const [id, s] of Object.entries(overridesRef.current)) {
      const row = rows.find((r) => r.id === id) ?? (detail?.id === id ? detail : undefined);
      if (row?.status === s) dispatch({ type: "settle", id });
    }
  }, [rows, detail]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const setApptParam = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("appt", id);
    else url.searchParams.delete("appt");
    window.history.replaceState(window.history.state, "", url);
  };

  const openBooking = useCallback((p: Prefill = {}) => {
    setPrefill(p);
    setBookingOpen(true);
  }, []);

  const openDetails = useCallback((a: ApptVM) => {
    setOpenAppt(a);
    setApptParam(a.id);
  }, []);

  const closeDetails = useCallback(() => {
    setOpenAppt(null);
    setApptParam(null);
  }, []);

  const statusOf = useCallback((a: ApptVM) => overrides[a.id] ?? a.status, [overrides]);

  const changeStatus = useCallback(
    (a: ApptVM, s: AppointmentStatus) => {
      const fd = new FormData();
      fd.set("id", a.id);
      fd.set("status", s);
      void changeStatusOptimistic(dispatch, overridesRef.current, a.id, s, () => updateAppointmentStatus(null, fd)).then((result) => {
        if (result?.ok) {
          toast(result.message ?? names[s]);
          refresh();
        } else toast(result?.message ?? labels.saveFailed, "error");
      });
    },
    [labels.saveFailed, names, refresh, toast],
  );

  const isHighlighted = useCallback(
    (a: ApptVM) => !!highlight && a.date === highlight.date && a.time === highlight.time && a.phone.replace(/\D/g, "").endsWith(highlight.phoneDigits.slice(-9)),
    [highlight],
  );

  // "N" opens the booking drawer, unless the user is typing or a drawer is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || bookingOpen || openAppt) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      openBooking();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingOpen, openAppt, openBooking]);

  function onBooked(b: Booked) {
    setBookingOpen(false);
    toast(labels.created);
    setHighlight(b);
    refresh();
    setTimeout(() => setHighlight((h) => (h === b ? null : h)), 2600);
  }

  const value: BoardCtx = { labels, names, isManager: booking.isManager, userId: booking.userId, openBooking, openDetails, statusOf, changeStatus, isHighlighted };

  return (
    <Ctx.Provider value={value}>
      {children}
      <BookingDrawer open={bookingOpen} prefill={prefill} data={booking} labels={labels} onClose={() => setBookingOpen(false)} onBooked={onBooked} />
      <DetailsDrawer
        key={openAppt?.id ?? "none"}
        appt={openAppt}
        status={openAppt ? statusOf(openAppt) : undefined}
        todayIso={booking.todayIso}
        labels={labels}
        names={names}
        onClose={closeDetails}
        onStatus={(s) => openAppt && changeStatus(openAppt, s)}
        onRescheduled={(message) => {
          closeDetails();
          toast(message);
          refresh();
        }}
      />
      <div role="status" aria-live="polite" aria-label={labels.notifications} className="pointer-events-none fixed right-4 bottom-24 z-[70] flex flex-col items-end gap-2 lg:bottom-6">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={`ap-slide pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-[var(--ap-drawer-shadow)] ${
              t.tone === "ok" ? "border-ap-sel-line bg-ap-sel text-ap-ink" : "border-danger bg-danger-soft text-danger"
            }`}
          >
            {t.text}
          </p>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Header "+ New booking" button (also the target of the N shortcut). */
export function NewBookingButton() {
  const { labels: p, openBooking } = useBoard();
  return (
    <button
      type="button"
      onClick={() => openBooking()}
      aria-keyshortcuts="N"
      title={p.shortcut}
      className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-[18px] text-sm font-bold text-ap-on-green hover:bg-brand-hi"
    >
      <Plus aria-hidden className="size-4" strokeWidth={2.4} />
      {p.newBooking}
    </button>
  );
}
