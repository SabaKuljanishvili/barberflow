// Pure helpers for the call sample section (call-sample.tsx).

/** Waveform bar heights in px (22 bars, max 44). */
export const WAVE_BARS = [10, 18, 28, 16, 34, 22, 40, 26, 14, 30, 44, 24, 36, 18, 28, 40, 20, 32, 16, 26, 12, 20] as const;

/** Masked caller number shown on the phone. */
export const CALLER_NUMBER = "+995 5•• ••• •92";

/** Time of the booking shown on the phone's booking card. */
export const BOOKING_TIME = "14:00";

/** Phone timer when there is no recording: the phone is then a still illustration. */
export const STILL_TIMER = "00:14";

const whole = (seconds: number) => (Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0);

/** Phone call timer, "mm:ss" ("00:14"). */
export function clock(seconds: number): string {
  const s = whole(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Short duration for the play button, "m:ss" ("0:42"). */
export function shortDuration(seconds: number): string {
  const s = whole(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Index of the transcript line playing at `time`: the last cue at or before
 * it. -1 without cues, or before the first cue.
 */
export function activeLine(cues: readonly number[] | null, time: number): number {
  if (!cues) return -1;
  let index = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i] <= time) index = i;
    else break;
  }
  return index;
}

/**
 * Whether bar `i` is drawn in the accent colour. With playback progress
 * (0–1) the played part is lit; otherwise every 4th bar is.
 */
export function barLit(i: number, progress: number | null): boolean {
  if (progress === null) return i % 4 === 3;
  return i < Math.round(progress * WAVE_BARS.length);
}
