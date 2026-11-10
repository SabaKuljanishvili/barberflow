"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmt } from "@/i18n/config";
import { HOUR_PX, blockBox, emptySlotStarts, gridHeight, hhmm, hourLabels, hourSpan, layoutLanes, nowOffset } from "@/lib/appointments-ui";
import { zonedParts } from "@/lib/time";
import { Avatar } from "./booking-drawer";
import { useBoard } from "./board";
import { toneStyle } from "./menus";
import { colorVar, type ApptVM, type BarberVM } from "./types";

type HoursLite = { opensAt: string; closesAt: string };

/** Minutes since midnight in the salon, ticking every 30s; the server's value on first paint. */
function useNowMinute(initial: number | null, timeZone: string, live: boolean) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      const p = zonedParts(new Date(), timeZone);
      setNow(p.hour * 60 + p.minute);
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [live, timeZone]);
  return live ? now : null;
}

const gridLines: React.CSSProperties = {
  backgroundImage: "linear-gradient(to bottom, var(--ap-hour) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--ap-hour) 55%, transparent) 1px, transparent 1px)",
  backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX}px`,
  backgroundPosition: `0 0, 0 ${HOUR_PX / 2}px`,
};

function blockColors(a: ApptVM): React.CSSProperties {
  const c = colorVar(a.color);
  return { background: `color-mix(in srgb, ${c} 18%, var(--ap-bg))`, borderLeft: `3px solid ${c}` };
}

/**
 * The calendar body's scroll box. It is the same element across date
 * changes, so the scroll position stays; on first paint it scrolls to the
 * current time (or opening time) once.
 */
function ScrollBody({ children, initialTop, minWidth }: { children: React.ReactNode; initialTop: number; minWidth: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    if (done.current || !ref.current) return;
    done.current = true;
    ref.current.scrollTop = Math.max(0, initialTop - 120);
  }, [initialTop]);
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-ap-line bg-ap-bg">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

function TimeAxis({ labels, height }: { labels: string[]; height: number }) {
  return (
    <div aria-hidden className="sticky left-0 z-20 bg-ap-bg" style={{ height }}>
      {labels.map((l) => (
        <span key={l} className="block pt-1 pr-2.5 text-right text-[11px] text-ap-faint tabular-nums" style={{ height: HOUR_PX }}>
          {l}
        </span>
      ))}
    </div>
  );
}

function NowLine({ top, dot }: { top: number; dot: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-accent" style={{ top }}>
      {dot && <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-accent" />}
    </span>
  );
}

function Closed({ label }: { label: string }) {
  return <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ap-faint">{label}</span>;
}

/** Hidden 30-minute targets; hovering one shows the dashed "+ Booking HH:MM" pill. */
function EmptySlots({ starts, spanStart, onPick, label, pill }: { starts: number[]; spanStart: number; onPick: (time: string) => void; label: (time: string) => string; pill: string }) {
  return (
    <>
      {starts.map((m) => {
        const time = hhmm(m);
        return (
          <button
            key={m}
            type="button"
            tabIndex={-1}
            aria-label={label(time)}
            onClick={() => onPick(time)}
            className="group absolute inset-x-1.5 z-0 flex items-center rounded-[7px] focus-visible:outline-none"
            style={{ top: ((m - spanStart) / 60) * HOUR_PX + 2, height: HOUR_PX / 2 - 4 }}
          >
            <span className="flex h-full w-full items-center justify-center rounded-[7px] border border-dashed border-accent/50 bg-brand/10 text-[11px] font-bold text-accent opacity-0 transition-opacity group-hover:opacity-100">
              {fmt(pill, { time })}
            </span>
          </button>
        );
      })}
    </>
  );
}

// --- Day view: barbers as columns ---------------------------------------------

export function DayView({
  date,
  todayIso,
  closed,
  barbers,
  bookableIds,
  appts,
  hours,
  nowMin,
  timeZone,
}: {
  date: string;
  todayIso: string;
  closed: boolean;
  barbers: BarberVM[];
  bookableIds: string[];
  appts: ApptVM[];
  hours: HoursLite;
  nowMin: number | null;
  timeZone: string;
}) {
  const { labels: p, names, openBooking, openDetails, statusOf, isHighlighted } = useBoard();
  const isToday = date === todayIso;
  const now = useNowMinute(nowMin, timeZone, isToday);
  const span = hourSpan(hours.opensAt, hours.closesAt);
  const height = gridHeight(span);
  const nowTop = isToday ? nowOffset(now, hours, span) : null;
  const starts = closed || date < todayIso ? [] : emptySlotStarts(hours, isToday ? now : null);
  const cols = `56px repeat(${Math.max(barbers.length, 1)}, minmax(150px, 1fr))`;

  if (!barbers.length) return <p className="rounded-2xl border border-ap-line bg-ap-bg p-6 text-sm text-ap-muted">{p.noBarbers}</p>;

  return (
    <ScrollBody initialTop={nowTop ?? 0} minWidth={`${56 + barbers.length * 150}px`}>
      <div className="sticky top-0 z-30 grid h-[52px] border-b border-ap-line bg-ap-bg" style={{ gridTemplateColumns: cols }}>
        <span className="sticky left-0 bg-ap-bg" />
        {barbers.map((b) => (
          <div key={b.id} className="flex min-w-0 items-center gap-2.5 border-l border-ap-hour px-3.5">
            <Avatar barber={b} />
            <span className="flex min-w-0 flex-col leading-tight">
              <b className="truncate text-[13px] leading-[15px]">{b.name}</b>
              <span className="text-[11px] text-ap-muted">{b.count === 1 ? p.bookingsOne : fmt(p.bookingsMany, { n: b.count })}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <TimeAxis labels={hourLabels(span)} height={height} />
        {barbers.map((b, i) => {
          const mine = appts.filter((a) => a.staffId === b.id);
          return (
            <div key={b.id} className={`relative border-l border-ap-hour ${closed ? "bg-ap-closed" : ""}`} style={{ height, ...gridLines }}>
              {closed && i === 0 && <Closed label={p.closed} />}
              {!closed && bookableIds.includes(b.id) && (
                <EmptySlots
                  starts={starts}
                  spanStart={span.startMin}
                  pill={p.addAt}
                  onPick={(time) => openBooking({ staffId: b.id, date, time })}
                  label={(time) => fmt(p.bookAt, { time, barber: b.name })}
                />
              )}
              {mine.map((a) => {
                const box = blockBox(a.startMin, a.endMin, span);
                if (!box) return null;
                const s = statusOf(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openDetails(a)}
                    className={`absolute inset-x-1.5 z-10 flex flex-col gap-0.5 overflow-hidden rounded-[9px] px-2.5 py-1 text-left hover:brightness-110 ${isHighlighted(a) ? "ap-flash" : ""} ${s === "cancelled" || s === "no_show" ? "opacity-70" : ""}`}
                    style={{ top: box.top, height: box.height, ...blockColors(a) }}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <b className="truncate text-[13px]">
                        {a.time} · {a.client}
                      </b>
                      <span className="shrink-0 rounded-md px-1.5 py-px text-[10px] leading-[13px] font-bold" style={toneStyle(s, 16)}>
                        {names[s]}
                      </span>
                    </span>
                    <span className="truncate text-xs leading-[14px] text-ap-ink2">
                      {a.service} · {fmt(p.minutes, { n: a.duration })}
                    </span>
                  </button>
                );
              })}
              {nowTop !== null && <NowLine top={nowTop} dot={i === 0} />}
            </div>
          );
        })}
      </div>
    </ScrollBody>
  );
}

// --- Week view: seven day columns ---------------------------------------------

export type WeekDay = { iso: string; weekday: string; num: string; closed: boolean; label: string };

export function WeekView({
  days,
  todayIso,
  appts,
  hours,
  nowMin,
  timeZone,
  dayHref,
}: {
  days: WeekDay[];
  todayIso: string;
  appts: ApptVM[];
  hours: HoursLite;
  nowMin: number | null;
  timeZone: string;
  dayHref: Record<string, string>;
}) {
  const { labels: p, isManager, userId, openBooking, openDetails, isHighlighted } = useBoard();
  const hasToday = days.some((d) => d.iso === todayIso);
  const now = useNowMinute(nowMin, timeZone, hasToday);
  const span = hourSpan(hours.opensAt, hours.closesAt);
  const height = gridHeight(span);
  const nowTop = hasToday ? nowOffset(now, hours, span) : null;
  const cols = "56px repeat(7, minmax(var(--ap-day-min), 1fr))";

  return (
    <ScrollBody initialTop={nowTop ?? 0} minWidth="calc(56px + 7 * var(--ap-day-min))">
      <div className="sticky top-0 z-30 grid h-[52px] border-b border-ap-line bg-ap-bg" style={{ gridTemplateColumns: cols }}>
        <span className="sticky left-0 bg-ap-bg" />
        {days.map((d) => {
          const today = d.iso === todayIso;
          return (
            <Link
              key={d.iso}
              href={dayHref[d.iso]}
              aria-label={d.label}
              aria-current={today ? "date" : undefined}
              className="flex items-center justify-center gap-2 border-l border-ap-hour hover:bg-ap-row"
            >
              <span className={`text-xs font-semibold ${today ? "text-accent" : d.closed ? "text-ap-faint" : "text-ap-muted"}`}>{d.weekday}</span>
              <span
                className={`flex size-[30px] items-center justify-center rounded-full text-sm font-bold ${today ? "bg-brand text-ap-on-green" : d.closed ? "text-ap-faint" : "text-ap-ink"}`}
              >
                {d.num}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <TimeAxis labels={hourLabels(span)} height={height} />
        {days.map((d) => {
          const today = d.iso === todayIso;
          const starts = d.closed || d.iso < todayIso ? [] : emptySlotStarts(hours, today ? now : null);
          const laid = layoutLanes(appts.filter((a) => a.date === d.iso));
          return (
            <div key={d.iso} className={`relative border-l border-ap-hour ${today ? "bg-ap-today" : d.closed ? "bg-ap-closed" : ""}`} style={{ height, ...gridLines }}>
              {d.closed && <Closed label={p.closed} />}
              <EmptySlots
                starts={starts}
                spanStart={span.startMin}
                pill={p.addAt}
                onPick={(time) => openBooking({ staffId: isManager ? "" : userId, date: d.iso, time })}
                label={(time) => `${d.label}, ${time}`}
              />
              {laid.map((a) => {
                const box = blockBox(a.startMin, a.endMin, span);
                if (!box) return null;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openDetails(a)}
                    className={`absolute z-10 flex min-w-0 flex-col overflow-hidden rounded-[9px] px-2 py-[5px] text-left hover:brightness-110 ${isHighlighted(a) ? "ap-flash" : ""}`}
                    style={{
                      top: box.top,
                      height: box.height,
                      left: `calc(${(a.lane * 100) / a.lanes}% + 4px)`,
                      width: `calc(${100 / a.lanes}% - 8px)`,
                      ...blockColors(a),
                    }}
                  >
                    <b className="truncate text-xs leading-[14px]">
                      {a.time} · {a.client}
                    </b>
                    <span className="truncate text-[11px] leading-[13px] text-ap-ink2">
                      {a.service} · {a.barber}
                    </span>
                  </button>
                );
              })}
              {today && nowTop !== null && <NowLine top={nowTop} dot />}
            </div>
          );
        })}
      </div>
    </ScrollBody>
  );
}
