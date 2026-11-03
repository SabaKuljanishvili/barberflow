import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, with a BOM for Excel", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line1\nline2", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line1\nline2",\r\n');
  });
  it("neutralises spreadsheet formulas", () => {
    const csv = toCsv(["n"], [["=HYPERLINK(1)"], ["+995599"], ["-1"], ["@x"], [42]]);
    expect(csv.slice(1).split("\r\n").slice(1, 6)).toEqual(["'=HYPERLINK(1)", "'+995599", "'-1", "'@x", "42"]);
  });
});
