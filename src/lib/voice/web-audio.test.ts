import { describe, expect, it } from "vitest";
import { base64ToBytes, concat, downsample, encodeWav, Endpointer, rms } from "./web-audio";

describe("downsample", () => {
  it("averages 48 kHz down to 16 kHz", () => {
    const out = downsample(Float32Array.from([0.3, 0.3, 0.3, -0.6, 0, 0]), 48_000);
    expect(Array.from(out).map((x) => Number(x.toFixed(3)))).toEqual([0.3, -0.2]);
  });

  it("copies when the rate already matches", () => {
    const input = Float32Array.from([0.1, 0.2]);
    const out = downsample(input, 16_000);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header and clamps samples", () => {
    const wav = encodeWav(Float32Array.from([0, 1, -1, 2]), 16_000);
    const view = new DataView(wav);
    const ascii = (at: number) => String.fromCharCode(...new Uint8Array(wav, at, 4));
    expect(wav.byteLength).toBe(44 + 8);
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)]).toEqual([0, 32767, -32768, 32767]);
  });
});

describe("helpers", () => {
  it("concatenates chunks and measures level", () => {
    expect(Array.from(concat([Float32Array.from([1]), Float32Array.from([2, 3])]))).toEqual([1, 2, 3]);
    expect(rms(Float32Array.from([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rms(new Float32Array(0))).toBe(0);
  });

  it("decodes base64", () => {
    expect(Array.from(base64ToBytes("AQID"))).toEqual([1, 2, 3]);
  });
});

describe("Endpointer", () => {
  const run = (e: Endpointer, level: number, ms: number) => {
    let last = e.push(level, 100);
    for (let t = 100; t < ms; t += 100) last = e.push(level, 100);
    return last;
  };

  it("ends the turn after speech then silence", () => {
    const e = new Endpointer();
    expect(run(e, 0.002, 300)).toBe("waiting");
    expect(run(e, 0.2, 800)).toBe("speaking");
    expect(run(e, 0.002, 1000)).toBe("speaking");
    expect(run(e, 0.002, 200)).toBe("done");
    expect(e.push(0.3, 100)).toBe("done");
  });

  it("ignores a click shorter than the minimum speech", () => {
    const e = new Endpointer({ noSpeechMs: 3_000 });
    run(e, 0.002, 300);
    run(e, 0.3, 100);
    expect(run(e, 0.002, 2_700)).toBe("no-speech");
  });

  it("raises the threshold over a noisy floor", () => {
    const e = new Endpointer({ noSpeechMs: 2_000 });
    run(e, 0.05, 300);
    expect(run(e, 0.06, 1_000)).toBe("waiting");
    expect(run(e, 0.3, 500)).toBe("speaking");
  });

  it("caps a long turn", () => {
    const e = new Endpointer({ maxMs: 1_000 });
    run(e, 0.002, 300);
    expect(run(e, 0.3, 700)).toBe("done");
  });
});
