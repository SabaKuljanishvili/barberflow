"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { useReducedMotion } from "./use-reduced-motion";

type CallText = Dictionary["home"]["call"];

// 0 ringing · 1 typing(client) · 2 msg1 · 3 typing(agent) · 4 msg2 · 5 typing(client)
// 6 msg3 · 7 typing(agent) · 8 booking card · 9 SMS toast (hold), then back to 0.
const DURATIONS = [1900, 1100, 700, 1200, 700, 1100, 700, 1000, 1300, 5200];
const LAST = DURATIONS.length - 1;

function Typing({ out }: { out?: boolean }) {
  return (
    <div className={`bubble typing ${out ? "b-out" : "b-in"}`}>
      <i />
      <i />
      <i />
    </div>
  );
}

/** Hero visual: a looping, scripted phone call that ends in a booking. */
export function CallCard({ text, initial }: { text: CallText; initial: string }) {
  const [loopStep, setStep] = useState(0);
  const [loopSec, setSec] = useState(0);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  // Reduced motion: the finished call, no loop.
  const step = reduce ? LAST : loopStep;
  const sec = reduce ? 8 : loopSec;

  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => {
      if (step === LAST) setSec(0);
      setStep(step === LAST ? 0 : step + 1);
    }, DURATIONS[step]);
    return () => clearTimeout(id);
  }, [step, reduce]);

  const talking = step >= 1 && step <= 8;
  useEffect(() => {
    if (reduce || !talking) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [talking, reduce]);

  // 3D tilt on hover devices.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || reduce || !window.matchMedia("(hover: hover)").matches) return;
    function move(e: MouseEvent) {
      const r = card!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card!.style.transition = "transform .15s ease-out";
      card!.style.transform = `perspective(1100px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
    }
    function leave() {
      card!.style.transition = "";
      card!.style.transform = "";
    }
    card.addEventListener("mousemove", move);
    card.addEventListener("mouseleave", leave);
    return () => {
      card.removeEventListener("mousemove", move);
      card.removeEventListener("mouseleave", leave);
    };
  }, [reduce]);

  const ringing = step === 0;
  const ended = step >= 8;
  const [m1, m2, m3] = text.messages;

  return (
    <div className="hv r d5">
      <div className="hfloat">
        <div ref={cardRef} className="bf-card hcard" role="img" aria-label={text.label}>
          <div className="row chead">
            <div className="row">
              <span className={`cav ${ringing ? "ringing" : ""}`}>
                <span className="bf-ring" />
                <span className="bf-ring two" />
                <PhoneIcon size={18} stroke={1.8} />
              </span>
              <div>
                <div className="ctitle">{ringing ? text.incoming : ended ? text.booked : text.talking}</div>
                <div className="cmeta">
                  +995 5•• ••• •42 · {ringing ? "—" : `00:${String(sec).padStart(2, "0")}`}
                </div>
              </div>
            </div>
            {ringing && <span className="spill">{text.ringing}</span>}
            {talking && !ended && (
              <div className="wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            )}
            {ended && <span className="spill done">{text.ended}</span>}
          </div>
          <div className="msgs">
            {step === 1 && <Typing />}
            {step >= 2 && <div className="bubble b-in">{m1}</div>}
            {step === 3 && <Typing out />}
            {step >= 4 && <div className="bubble b-out">{m2}</div>}
            {step === 5 && <Typing />}
            {step >= 6 && <div className="bubble b-in">{m3}</div>}
            {step === 7 && <Typing out />}
          </div>
          <div className="slotbox">
            {step >= 8 && (
              <div className="slot">
                <span className="row">
                  <span className="av slot-av">{initial}</span>
                  <span className="slot-text">
                    <b>{text.service}</b>
                    <span>{text.when}</span>
                  </span>
                </span>
                <span className="okc">
                  <svg className="check" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {step >= 9 && (
        <div className="toast">
          <span className="okc">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9 22 2z" />
            </svg>
          </span>
          <span className="toast-text">
            <b>{text.smsSent}</b>
            <span>{text.smsNote}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function PhoneIcon({ size, stroke }: { size: number; stroke: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
