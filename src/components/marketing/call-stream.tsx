"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { AiMark } from "./ai-mark";
import { BOOKINGS, dateLabel, localIsoDate } from "./call-stream-data";
import { PhoneIcon } from "./phone-icon";
import { playSfx, unlockSfx, type SfxName } from "./sfx";
import { Timeline, TimelineCancelled } from "./timeline";
import { useReducedMotion } from "./use-reduced-motion";
import s from "./call-stream.module.css";

type Text = Dictionary["home"]["callStream"];
type RowState = "ring" | "ai" | "ok";
type Row = { id: number; state: RowState; booking: number; digits: number; prefilled?: boolean };

const START = 124;
const MAX_ROWS = 7;
// Complete at rest: bookings #1, #2, #3 from the top, as in the reference.
const PREFILL: Row[] = [0, 1, 2].map((booking) => ({ id: -1 - booking, state: "ok", booking, digits: 0, prefilled: true }));

// Timings (ms). One cycle = 1780: ring 450, AI answering 680 (4 blips), booked 650.
const FIRST_CALL = 250;
const RING = 450;
const BLIP_GAP = 170;
const BLIPS = 4;
const HOLD = 650;

const noop = () => () => {};

function RowView({ row, text, locale, today }: { row: Row; text: Text; locale: Locale; today: string }) {
  const cls = [s.row, s[row.state], row.state === "ring" ? s.in : "", row.state === "ok" ? (row.prefilled ? s.static : s.swap) : ""];
  const number = `+995 5•• ••• •${row.digits}`;
  const b = BOOKINGS[row.booking];
  return (
    <div className={cls.filter(Boolean).join(" ")}>
      {/* Keyed by state: each stage mounts fresh and plays its entrance. */}
      <Fragment key={row.state}>
        {row.state === "ring" && (
          <>
            <span className={s.av}>
              <PhoneIcon size={15} stroke={2} />
            </span>
            <span className={s.tx}>
              <b>{text.incoming}</b>
              <small>{number}</small>
            </span>
          </>
        )}
        {row.state === "ai" && (
          <>
            <AiMark className={s.rowMark} />
            <span className={s.tx}>
              <b>{text.aiAnswering}</b>
              <small>{number}</small>
            </span>
          </>
        )}
        {row.state === "ok" && b && (
          <>
            <span className={s.av}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17 4 12" />
              </svg>
            </span>
            <span className={s.tx}>
              <b>
                {text.services[b.service]} · {text.barbers[b.barber]}
              </b>
              <small>{fmt(text.bookedOn, { date: dateLabel(today, b.offsetDays, locale) })}</small>
            </span>
            <span className={s.tm}>{b.time}</span>
          </>
        )}
      </Fragment>
    </div>
  );
}

/**
 * Hero visual: incoming calls stream in, the DevskStudio AI mark answers each
 * one and it turns into a booking with a real date (today + n days).
 * Ported from call-stream-ai-reference.html.
 */
export function CallStream({ text, locale, today: serverToday }: { text: Text; locale: Locale; today: string }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Row[]>(PREFILL);
  const [calls, setCalls] = useState(START);
  const [booked, setBooked] = useState(START);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const nextBooking = useRef(PREFILL.length);
  // Hydrates with the server's date (Asia/Tbilisi), then switches to the
  // viewer's local date if it differs. No hydration mismatch either way.
  const today = useSyncExternalStore(noop, localIsoDate, () => serverToday);

  // Reduced motion: the prefilled list only.
  const shownRows = reduce ? PREFILL : rows;
  const shownCalls = reduce ? START : calls;
  const shownBooked = reduce ? START : booked;

  useEffect(() => {
    const root = rootRef.current;
    if (reduce || !root) return;
    // One Timeline, one async loop: exactly one stream, even when StrictMode
    // mounts twice (the first Timeline is destroyed before it ever fires).
    const tl = new Timeline();
    const snd = (n: SfxName) => {
      if (soundRef.current && !document.hidden) playSfx(n);
    };
    const update = (id: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const stream = async () => {
      await tl.wait(FIRST_CALL);
      for (;;) {
        const id = ++nextId.current;
        const digits = 10 + Math.floor(Math.random() * 90); // last two digits only
        setRows((list) => [{ id, state: "ring" as const, booking: -1, digits }, ...list].slice(0, MAX_ROWS));
        setCalls((c) => c + 1);
        snd("ringShort");
        await tl.wait(RING);
        update(id, { state: "ai" });
        for (let k = 0; k < BLIPS; k++) {
          snd("blip");
          await tl.wait(BLIP_GAP);
        }
        update(id, { state: "ok", booking: nextBooking.current++ % BOOKINGS.length });
        setBooked((c) => c + 1);
        snd("okSoft");
        await tl.wait(HOLD);
      }
    };
    stream().catch((e) => {
      if (!(e instanceof TimelineCancelled)) throw e;
    });

    // Freeze when off-screen or in a hidden tab: no CPU, no sound.
    let inView = true;
    const sync = () => {
      const paused = !inView || document.hidden;
      root.classList.toggle(s.paused, paused);
      if (paused) tl.pause();
      else tl.resume();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    io.observe(root);
    document.addEventListener("visibilitychange", sync);

    return () => {
      tl.destroy();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      root.classList.remove(s.paused);
    };
  }, [reduce]);

  function toggleSound() {
    const next = !soundRef.current;
    soundRef.current = next;
    if (next) unlockSfx();
    setSound(next);
  }

  const [missedBefore, missedAfter] = text.missed.split("{n}");

  return (
    <div ref={rootRef} className={`${s.cs} r d5`}>
      <div className={s.card}>
        {/* role="img" covers the visual only, so the sound button stays reachable. */}
        <div className={s.visual} role="img" aria-label={text.label}>
          <div className={s.head}>
            <span className={s.brand}>
              <AiMark size="lg" />
              <span className={s.brandTx}>
                <b>{text.brand}</b>
                <small>{text.brandSub}</small>
              </span>
            </span>
            <span className={s.cnts}>
              <span className={s.cnt}>
                {text.calls}{" "}
                <b key={shownCalls} className={shownCalls !== START ? s.bump : undefined}>
                  {shownCalls}
                </b>
              </span>
              <span className={s.cnt}>
                {text.booked}{" "}
                <b key={shownBooked} className={shownBooked !== START ? s.bump : undefined}>
                  {shownBooked}
                </b>
              </span>
            </span>
          </div>
          <div className={s.list}>
            {shownRows.map((row) => (
              <RowView key={row.id} row={row} text={text} locale={locale} today={today} />
            ))}
          </div>
        </div>
        <div className={s.foot}>
          <span>
            {missedBefore}
            <b>0</b>
            {missedAfter}
          </span>
          <button type="button" className={s.snd} aria-pressed={sound} aria-label={sound ? text.soundOff : text.soundOn} onClick={toggleSound}>
            <svg className={s.off} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <svg className={s.on} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
