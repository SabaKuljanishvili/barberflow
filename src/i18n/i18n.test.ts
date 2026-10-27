import { describe, expect, it } from "vitest";
import { fmt, negotiateLocale } from "./config";
import { en } from "./dictionaries/en";
import { ka } from "./dictionaries/ka";

type Tree = { [key: string]: string | Tree | Tree[] | string[] };

function leaves(tree: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof tree === "string") out.set(prefix, tree);
  else if (tree && typeof tree === "object") {
    for (const [k, v] of Object.entries(tree as Tree)) for (const [p, s] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(p, s);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  const enLeaves = leaves(en);
  const kaLeaves = leaves(ka);

  it("have the same keys, including array lengths", () => {
    expect([...kaLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it("use the same placeholders in every string", () => {
    for (const [key, text] of enLeaves) expect(placeholders(kaLeaves.get(key) ?? ""), key).toEqual(placeholders(text));
  });

  it("have no empty Georgian strings", () => {
    for (const [key, text] of kaLeaves) expect(text.trim(), key).not.toBe("");
  });
});

describe("negotiateLocale", () => {
  it.each([
    ["en-US,en;q=0.9", "en"],
    ["ka-GE,ka;q=0.9,en;q=0.8", "ka"],
    ["ru-RU,ru;q=0.9,en;q=0.5", "en"],
    ["de-DE", "ka"],
    ["", "ka"],
    [null, "ka"],
    ["en;q=0.2,ka;q=0.8", "ka"],
  ])("%s -> %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});

describe("fmt", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(fmt("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
