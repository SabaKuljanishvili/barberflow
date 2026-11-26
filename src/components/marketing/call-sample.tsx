"use client";

import { useEffect, useRef, useState } from "react";
import { AppLogo } from "./app-logo";
import { activeLine, barLit, BOOKING_TIME, CALLER_NUMBER, clock, shortDuration, STILL_TIMER, WAVE_BARS } from "./call-sample-data";

type Line = { who: string; text: string };

export type CallSampleLabels = {
  transcript: string;
  agent: string;
  caller: string;
  phoneLabel: string;
  answering: string;
  booking: string;
  play: string;
  pause: string;
  soon: string;
};

function PlayIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

/**
 * The call sample: a phone mockup with a play button, and the transcript.
 * With a recording (`src`) the button plays/pauses a real <audio>; the phone
 * timer, the waveform and (with `cues`) the highlighted transcript line follow
 * playback. Without one the button is disabled with a "coming soon" tooltip
 * and the phone is a still illustration: nothing pretends to play.
 */
export function CallSample({
  head,
  lines,
  labels,
  src,
  cues,
}: {
  head: React.ReactNode;
  lines: readonly Line[];
  labels: CallSampleLabels;
  src: string | null;
  cues: readonly number[] | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  // The server-rendered <audio> may load its metadata before hydration, so
  // its loadedmetadata event can fire before React listens. Read it once here.
  useEffect(() => {
    const el = audio.current;
    if (el && el.readyState >= 1 && Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const started = playing || time > 0;
  const progress = src && started && duration ? Math.min(1, time / duration) : null;
  const current = src && started ? activeLine(cues, time) : -1;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  return (
    <div className="cs-grid">
      <div className="cs-head">{head}</div>

      <div className="cs-stage">
        <div className="cs-phone" role="img" aria-label={labels.phoneLabel}>
          <div className="cs-screen">
            <span className="cs-island" />
            <AppLogo size={64} className="cs-logo" />
            <p className="cs-status">{labels.answering}</p>
            <p className="cs-number">{CALLER_NUMBER}</p>
            <p className="cs-timer">{src ? clock(time) : STILL_TIMER}</p>
            <div className="cs-wave">
              {WAVE_BARS.map((h, i) => (
                <i key={i} style={{ height: h }} data-lit={barLit(i, progress) || undefined} />
              ))}
            </div>
            <div className="cs-booking">
              <span className="cs-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <span className="cs-service">{labels.booking}</span>
              <span className="cs-btime">{BOOKING_TIME}</span>
            </div>
          </div>
        </div>

        {src ? (
          <div className="cs-ctl">
            <audio
              ref={audio}
              src={src}
              preload="metadata"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={(e) => {
                e.currentTarget.currentTime = 0;
                setTime(0);
                setPlaying(false);
              }}
            />
            <button type="button" className="cs-play" onClick={toggle}>
              <span className="cs-play-icon">{playing ? <PauseIcon /> : <PlayIcon />}</span>
              {playing ? labels.pause : labels.play}
              {!playing && duration ? <span className="cs-play-dur"> · {shortDuration(duration)}</span> : null}
            </button>
          </div>
        ) : (
          <div className="cs-ctl">
            {/* aria-disabled (not disabled) keeps it focusable, so the tooltip is reachable. */}
            <button type="button" className="cs-play" aria-disabled="true" aria-describedby="cs-soon">
              <span className="cs-play-icon">
                <PlayIcon />
              </span>
              {labels.play}
            </button>
            <span role="tooltip" id="cs-soon" className="cs-tip">
              {labels.soon}
            </span>
          </div>
        )}
      </div>

      <div className="cs-script">
        <h3 className="sr-only" id="cs-transcript">
          {labels.transcript}
        </h3>
        <ol className="cs-lines" aria-labelledby="cs-transcript">
          {lines.map((line, i) => (
            <li key={i} className={line.who === "agent" ? "cs-agent" : "cs-caller"} aria-current={i === current ? "time" : undefined}>
              <span className="cs-who">{line.who === "agent" ? labels.agent : labels.caller}</span>
              <q>{line.text}</q>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
