/**
 * Global tempo for the hero call stream: every `wait()` lasts `ms * SPEED`.
 * 0.8 = faster, 1.2 = slower. Tickers (clock, waveform) are not scaled.
 */
export const SPEED = 1;

/** Thrown out of `wait()` when the timeline is destroyed, to unwind the script. */
export class TimelineCancelled extends Error {
  constructor() {
    super("timeline cancelled");
  }
}

type Sleeper = { resolve: () => void; reject: (e: Error) => void; remaining: number; started: number; id?: ReturnType<typeof setTimeout> };
type Ticker = { ms: number; fn: () => void; id?: ReturnType<typeof setInterval> };

/**
 * A cancellable, pausable timeline for a scripted animation.
 * `wait()` sleeps (scaled by SPEED); `every()` runs a ticker. `pause()` freezes both (the
 * remaining sleep time is kept), `resume()` continues, `destroy()` clears
 * every timer and rejects pending waits with `TimelineCancelled`.
 */
export class Timeline {
  private sleepers = new Set<Sleeper>();
  private tickers = new Set<Ticker>();
  private paused = false;
  private dead = false;

  get alive() {
    return !this.dead;
  }

  wait(ms: number): Promise<void> {
    if (this.dead) return Promise.reject(new TimelineCancelled());
    return new Promise((resolve, reject) => {
      const s: Sleeper = { resolve, reject, remaining: ms * SPEED, started: 0 };
      this.sleepers.add(s);
      if (!this.paused) this.arm(s);
    });
  }

  /** Run `fn` every `ms` until `stopTickers()` or `destroy()`. */
  every(ms: number, fn: () => void) {
    if (this.dead) return;
    const t: Ticker = { ms, fn };
    this.tickers.add(t);
    if (!this.paused) t.id = setInterval(fn, ms);
  }

  stopTickers() {
    for (const t of this.tickers) clearInterval(t.id);
    this.tickers.clear();
  }

  pause() {
    if (this.paused || this.dead) return;
    this.paused = true;
    const now = Date.now();
    for (const s of this.sleepers) {
      clearTimeout(s.id);
      s.remaining = Math.max(0, s.remaining - (now - s.started));
    }
    for (const t of this.tickers) clearInterval(t.id);
  }

  resume() {
    if (!this.paused || this.dead) return;
    this.paused = false;
    for (const s of this.sleepers) this.arm(s);
    for (const t of this.tickers) t.id = setInterval(t.fn, t.ms);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.stopTickers();
    for (const s of this.sleepers) {
      clearTimeout(s.id);
      s.reject(new TimelineCancelled());
    }
    this.sleepers.clear();
  }

  private arm(s: Sleeper) {
    s.started = Date.now();
    s.id = setTimeout(() => {
      this.sleepers.delete(s);
      s.resolve();
    }, s.remaining);
  }
}
