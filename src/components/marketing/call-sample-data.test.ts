import { describe, expect, it } from "vitest";
import { activeLine, barLit, clock, shortDuration, WAVE_BARS } from "./call-sample-data";

describe("clock", () => {
  it("formats mm:ss", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(14.9)).toBe("00:14");
    expect(clock(75)).toBe("01:15");
  });
  it("treats NaN, Infinity and negatives as zero", () => {
    expect(clock(Number.NaN)).toBe("00:00");
    expect(clock(Number.POSITIVE_INFINITY)).toBe("00:00");
    expect(clock(-3)).toBe("00:00");
  });
});

describe("shortDuration", () => {
  it("formats m:ss", () => {
    expect(shortDuration(42.4)).toBe("0:42");
    expect(shortDuration(65)).toBe("1:05");
  });
});

describe("activeLine", () => {
  const cues = [0, 4.5, 8, 12];
  it("is -1 without cues", () => {
    expect(activeLine(null, 5)).toBe(-1);
  });
  it("is -1 before the first cue", () => {
    expect(activeLine([1, 2], 0.5)).toBe(-1);
  });
  it("picks the last cue at or before the time", () => {
    expect(activeLine(cues, 0)).toBe(0);
    expect(activeLine(cues, 4.5)).toBe(1);
    expect(activeLine(cues, 9)).toBe(2);
    expect(activeLine(cues, 99)).toBe(3);
  });
});

describe("barLit", () => {
  it("lights every 4th bar when nothing plays", () => {
    const lit = WAVE_BARS.map((_, i) => barLit(i, null));
    expect(lit.filter(Boolean)).toHaveLength(5);
    expect(lit[3]).toBe(true);
    expect(lit[0]).toBe(false);
  });
  it("lights the played part during playback", () => {
    expect(WAVE_BARS.map((_, i) => barLit(i, 0)).some(Boolean)).toBe(false);
    expect(WAVE_BARS.map((_, i) => barLit(i, 0.5)).filter(Boolean)).toHaveLength(11);
    expect(WAVE_BARS.map((_, i) => barLit(i, 1)).every(Boolean)).toBe(true);
  });
});
