"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { rescheduleAppointment } from "@/app/dashboard/actions";
import { SlotPicker } from "@/components/dashboard/slot-picker";
import { fmt } from "@/i18n/config";
import { canReschedule } from "@/lib/booking-rules";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { StatusMenu } from "./menus";
import { Sheet } from "./sheet";
import { colorVar, type ApptVM, type Labels, type StatusNames } from "./types";

/**
 * Appointment details in the same slide-over as booking: status, reschedule
 * (existing rescheduleAppointment + SlotPicker), cancel, open the client.
 */
export function DetailsDrawer({
  appt,
  status,
  todayIso,
  labels: p,
  names,
  onClose,
  onStatus,
  onRescheduled,
}: {
  appt: ApptVM | null;
  status: AppointmentStatus | undefined;
  todayIso: string;
  labels: Labels;
  names: StatusNames;
  onClose: () => void;
  onStatus: (s: AppointmentStatus) => void;
  onRescheduled: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!appt || !status) return null;
  const movable = appt.canEdit && canReschedule(status);

  function reschedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      let result: Awaited<ReturnType<typeof rescheduleAppointment>> = null;
      try {
        result = await rescheduleAppointment(null, fd);
      } catch {
        result = null;
      }
      if (result?.ok) onRescheduled(result.message ?? "");
      else setError(result?.fieldErrors?.localTime?.join(" ") ?? result?.message ?? p.saveFailed);
    });
  }

  return (
    <Sheet open onClose={onClose} label={p.details} closeLabel={p.close}>
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-1 text-sm">
          <dt className="sr-only">{p.client}</dt>
          <dd className="text-lg font-bold">{appt.client}</dd>
          <dd className="text-ap-muted tabular-nums">{appt.phone}</dd>
          <dt className="sr-only">{p.when}</dt>
          <dd className="mt-2 font-semibold">
            <time dateTime={`${appt.date}T${appt.time}`}>{appt.when}</time>
          </dd>
          <dt className="sr-only">{p.service}</dt>
          <dd className="flex items-center gap-2 text-ap-ink2">
            <span aria-hidden className="size-2 rounded-full" style={{ background: colorVar(appt.color) }} />
            {appt.service} · {fmt(p.minutes, { n: appt.duration })} · {appt.barber}
          </dd>
          <dt className="sr-only">{p.colSource}</dt>
          <dd className="text-ap-muted">{appt.source === "voice" ? p.sourceVoice : p.sourceDashboard}</dd>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <StatusMenu status={status} onChange={onStatus} canEdit={appt.canEdit} who={appt.client} labels={p} names={names} />
          <Link href={`/dashboard/clients/${appt.clientId}`} className="inline-flex h-10 items-center text-sm font-semibold text-accent">
            {p.openClient}
          </Link>
        </div>

        {movable && (
          <form onSubmit={reschedule} noValidate className="flex flex-col gap-3 border-t border-ap-line pt-4" aria-label={p.reschedule}>
            <h3 className="text-[13px] font-bold">{p.reschedule}</h3>
            <input type="hidden" name="id" value={appt.id} />
            <input type="hidden" name="serviceId" value={appt.serviceId} />
            <input type="hidden" name="staffId" value={appt.staffId} />
            <SlotPicker
              name="localTime"
              defaultDate={appt.date < todayIso ? todayIso : appt.date}
              minDate={todayIso}
              labels={{ label: p.dateTime, date: p.date, pickService: p.pickServiceFirst, loading: p.loadingSlots, none: p.noSlots, failed: p.slotsFailed, slotsFor: p.freeTimes }}
            />
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ap-chip-line text-sm font-bold text-ap-ink hover:border-ap-sel-line disabled:opacity-60"
            >
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {p.rescheduleButton}
            </button>
          </form>
        )}

        {appt.canEdit && status !== "cancelled" && (
          <div className="border-t border-ap-line pt-4">
            {confirming ? (
              <div className="flex flex-col gap-2" role="group" aria-label={p.cancelConfirm}>
                <p className="text-sm font-semibold">{p.cancelConfirm}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      setConfirming(false);
                      onStatus("cancelled");
                    }}
                    className="h-10 rounded-xl bg-danger-soft px-4 text-sm font-bold text-danger"
                  >
                    {p.cancelYes}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-xl border border-ap-chip-line px-4 text-sm font-semibold text-ap-ink2">
                    {p.keep}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-xl border border-ap-chip-line px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
                {p.cancelBooking}
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
