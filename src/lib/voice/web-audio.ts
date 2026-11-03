// Browser-side audio helpers for the web voice agent. Pure functions (no DOM),
// so they run in tests and in the browser alike.
//
// The page records the microphone with Web Audio, detects when the speaker
// stops (Endpointer), downsamples to 16 kHz mono and uploads it as 16-bit PCM
// WAV, the format Azure's short-audio speech-to-text takes directly.

/** Header the dashboard sends with every /api/voice/web request (CSRF guard). */
export const WEB_VOICE_HEADER = "x-bf-voice";

export const STT_SAMPLE_RATE = 16_000;

/** Averages input samples into `toRate` buckets (a cheap low-pass + decimate). */
export function downsample(input: Float32Array, fromRate: number, toRate = STT_SAMPLE_RATE): Float32Array {
  if (fromRate === toRate) return input.slice();
  if (fromRate < toRate) throw new Error("upsampling is not supported");
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function concat(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate = STT_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Root mean square level of one frame, 0..1. */
export function rms(frame: Float32Array): number {
  let sum = 0;
  for (const x of frame) sum += x * x;
  return frame.length ? Math.sqrt(sum / frame.length) : 0;
}

export type EndpointerOptions = {
  /** Silence after speech that ends the turn. */
  silenceMs?: number;
  /** Speech shorter than this is a click or cough, not a turn. */
  minSpeechMs?: number;
  /** Give up when nobody starts speaking. */
  noSpeechMs?: number;
  /** Hard cap on one turn. */
  maxMs?: number;
  /** Lowest level that counts as speech, whatever the noise floor. */
  minThreshold?: number;
};

export type EndpointerEvent = "waiting" | "speaking" | "done" | "no-speech";

/**
 * Voice activity detection by level. The first 300 ms calibrate the noise
 * floor; speech is anything 2.5x above it. Feed it one frame at a time.
 */
export class Endpointer {
  private elapsed = 0;
  private speech = 0;
  private silence = 0;
  private floor = 0;
  private calibrated = 0;
  private finished: EndpointerEvent | null = null;
  private readonly o: Required<EndpointerOptions>;

  constructor(options: EndpointerOptions = {}) {
    this.o = { silenceMs: 1_100, minSpeechMs: 250, noSpeechMs: 8_000, maxMs: 20_000, minThreshold: 0.012, ...options };
  }

  get heardSpeech(): boolean {
    return this.speech >= this.o.minSpeechMs;
  }

  push(level: number, frameMs: number): EndpointerEvent {
    if (this.finished) return this.finished;
    this.elapsed += frameMs;
    if (this.calibrated < 300) {
      this.floor = (this.floor * this.calibrated + level * frameMs) / (this.calibrated + frameMs);
      this.calibrated += frameMs;
    }
    const threshold = Math.max(this.o.minThreshold, this.floor * 2.5);

    if (level >= threshold) {
      this.speech += frameMs;
      this.silence = 0;
    } else if (this.speech > 0) {
      this.silence += frameMs;
    }

    if (this.heardSpeech && this.silence >= this.o.silenceMs) return (this.finished = "done");
    if (this.elapsed >= this.o.maxMs) return (this.finished = this.heardSpeech ? "done" : "no-speech");
    if (!this.heardSpeech && this.elapsed >= this.o.noSpeechMs) return (this.finished = "no-speech");
    return this.heardSpeech ? "speaking" : "waiting";
  }
}

/** Base64 to bytes, for the MP3 the route returns. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
