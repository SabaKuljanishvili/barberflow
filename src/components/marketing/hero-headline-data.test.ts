import { describe, expect, it } from "vitest";
import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { ka } from "@/i18n/dictionaries/ka";
import { splitHeadline } from "./hero-headline-data";

const text = (d: Dictionary) => ({ before: d.home.titleBefore, green: d.home.titleGreen, after: d.home.titleAfter });
const word = (w: { ch: string }[]) => w.map((c) => c.ch).join("");

describe("splitHeadline", () => {
  it("splits the Georgian headline into whole words, punctuation on the last one", () => {
    const p = splitHeadline(text(ka));
    expect(p.words.map(word)).toEqual(["აღარც", "ერთი", "უპასუხო", "ზარი."]);
    expect(p.label).toBe("აღარც ერთი უპასუხო ზარი.");
  });

  it("numbers letters across the headline and within the green phrase", () => {
    const chars = splitHeadline(text(en)).words.flat();
    expect(chars.map((c) => c.i)).toEqual(chars.map((_, n) => n));
    const green = chars.filter((c) => c.j !== null);
    expect(green.map((c) => c.ch).join("")).toBe("anothercall");
    expect(green.map((c) => c.j)).toEqual(green.map((_, n) => n));
    // The full stop is not green.
    expect(chars.at(-1)).toMatchObject({ ch: ".", j: null });
  });

  it("times --end and --after from the letter count", () => {
    const p = splitHeadline(text(en)); // "Nevermissanothercall." = 21 letters
    expect(p.end).toBe(150 + 20 * 24 + 700);
    expect(p.after).toBe(p.end - 300);
  });
});
