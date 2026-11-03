import { describe, expect, it } from "vitest";
import { stickyShift } from "./smooth-scroll-shared";

// top: 100, box 300 tall, containing block ends at viewport y 1000.
const shift = (layoutTop: number, limitBottom = 1000) => stickyShift(100, layoutTop, 300, limitBottom);

describe("stickyShift", () => {
  it("does nothing while the box is below its sticky line", () => {
    expect(shift(400)).toBe(0);
    expect(shift(100)).toBe(0);
  });

  it("holds the box at its sticky line once it scrolls past", () => {
    expect(shift(40)).toBe(60);
    expect(shift(-500)).toBe(600);
  });

  it("stops at the bottom of the containing block", () => {
    // At layoutTop -500 the sticky line asks for 600; the block end allows
    // limitBottom - (layoutTop + height) = limitBottom + 200.
    expect(shift(-500, 200)).toBe(400);
    expect(shift(-500, 0)).toBe(200);
  });

  it("never shifts upwards", () => {
    expect(shift(900, 1000)).toBe(0);
    expect(shift(-500, -1000)).toBe(0);
  });
});
