import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPEED, Timeline, TimelineCancelled } from "./timeline";

describe("Timeline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves wait() after the given time", async () => {
    const tl = new Timeline();
    const done = vi.fn();
    void tl.wait(500).then(done);
    await vi.advanceTimersByTimeAsync(500 * SPEED - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledOnce();
  });

  it("scales every wait by SPEED", async () => {
    const tl = new Timeline();
    const done = vi.fn();
    void tl.wait(1000).then(done);
    await vi.advanceTimersByTimeAsync(1000 * SPEED - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledOnce();
  });

  it("keeps the remaining time across pause and resume", async () => {
    const tl = new Timeline();
    const done = vi.fn();
    void tl.wait(1000).then(done);
    await vi.advanceTimersByTimeAsync(400);
    tl.pause();
    await vi.advanceTimersByTimeAsync(5000);
    expect(done).not.toHaveBeenCalled();
    tl.resume();
    await vi.advanceTimersByTimeAsync(1000 * SPEED - 400 - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledOnce();
  });

  it("does not start waits that begin while paused", async () => {
    const tl = new Timeline();
    tl.pause();
    const done = vi.fn();
    void tl.wait(100).then(done);
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).not.toHaveBeenCalled();
    tl.resume();
    await vi.advanceTimersByTimeAsync(100 * SPEED);
    expect(done).toHaveBeenCalledOnce();
  });

  it("stops tickers on pause and restarts them on resume", async () => {
    const tl = new Timeline();
    const tick = vi.fn();
    tl.every(90, tick);
    await vi.advanceTimersByTimeAsync(270);
    expect(tick).toHaveBeenCalledTimes(3);
    tl.pause();
    await vi.advanceTimersByTimeAsync(900);
    expect(tick).toHaveBeenCalledTimes(3);
    tl.resume();
    await vi.advanceTimersByTimeAsync(90);
    expect(tick).toHaveBeenCalledTimes(4);
    tl.stopTickers();
    await vi.advanceTimersByTimeAsync(900);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it("destroy() rejects pending waits and clears every timer", async () => {
    const tl = new Timeline();
    const tick = vi.fn();
    tl.every(90, tick);
    const pending = tl.wait(1000);
    tl.destroy();
    await expect(pending).rejects.toBeInstanceOf(TimelineCancelled);
    await expect(tl.wait(10)).rejects.toBeInstanceOf(TimelineCancelled);
    expect(tl.alive).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).not.toHaveBeenCalled();
  });
});
