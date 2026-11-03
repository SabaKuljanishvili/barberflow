/**
 * Hero call stream sound effects: synthesized with Web Audio, no audio files.
 * The AudioContext is created lazily, on the first user click (browsers block
 * autoplaying audio). Recipes from call-stream-ai-reference.html.
 */

export type SfxName = "ringShort" | "blip" | "okSoft";

type ToneOpts = { type?: OscillatorType; gain?: number; attack?: number };

let ac: AudioContext | null = null;
let master: GainNode | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.7;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ac.destination);
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

function tone(f: number, t0: number, dur: number, o: ToneOpts = {}) {
  const a = ctx();
  if (!a || !master) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t0 + (o.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function now() {
  const a = ctx();
  return a ? a.currentTime + 0.01 : 0;
}

const SFX: Record<SfxName, () => void> = {
  ringShort() {
    const t = now();
    tone(1046.5, t, 0.12, { type: "triangle", gain: 0.07 });
    tone(1318.5, t + 0.07, 0.14, { type: "triangle", gain: 0.06 });
  },
  blip() {
    tone(820 + Math.random() * 180, now(), 0.05, { gain: 0.03 });
  },
  okSoft() {
    const t = now();
    tone(783.99, t, 0.35, { type: "triangle", gain: 0.07 });
    tone(1174.66, t + 0.07, 0.45, { type: "triangle", gain: 0.06 });
  },
};

/** Create (or resume) the AudioContext. Call from a click handler. */
export function unlockSfx() {
  ctx();
}

/** Play a sound now. The caller decides whether sound is on. */
export function playSfx(name: SfxName) {
  SFX[name]();
}
