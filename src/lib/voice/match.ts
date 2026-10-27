// Turns caller speech/keypad input into a choice from a spoken list.
// Works for Georgian and English input regardless of the call's language:
// callers mix them ("ნომერი two"), and recognizers sometimes return digits.

import type { Locale } from "@/i18n/config";

const EN_NUMBERS: Record<string, number> = {
  one: 1, first: 1,
  two: 2, second: 2,
  three: 3, third: 3,
  four: 4, fourth: 4,
  five: 5, fifth: 5,
  six: 6, sixth: 6,
  seven: 7, seventh: 7,
  eight: 8, eighth: 8,
  nine: 9, ninth: 9,
};

// Cardinals and ordinals; inflected forms ("ორს", "მეორეს", "მეორეზე") are
// generated below.
const KA_WORDS: [string, number][] = [
  ["ერთი", 1], ["პირველი", 1],
  ["ორი", 2], ["მეორე", 2],
  ["სამი", 3], ["მესამე", 3],
  ["ოთხი", 4], ["მეოთხე", 4],
  ["ხუთი", 5], ["მეხუთე", 5],
  ["ექვსი", 6], ["მეექვსე", 6],
  ["შვიდი", 7], ["მეშვიდე", 7],
  ["რვა", 8], ["მერვე", 8],
  ["ცხრა", 9], ["მეცხრე", 9],
];

const NUMBER_WORDS: Record<string, number> = { ...EN_NUMBERS };
for (const [word, n] of KA_WORDS) {
  const stem = word.endsWith("ი") ? word.slice(0, -1) : word;
  for (const form of [word, `${stem}ს`, `${stem}ზე`, `${word}ს`, `${word}ზე`]) NUMBER_WORDS[form] = n;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the 0-based index of the chosen option, or null.
 * Accepts a keypad digit, a spoken ordinal ("the second one", "მეორე"), or
 * words from the option label ("skin fade", "წვერი").
 */
export function matchChoice(input: { digits?: string | null; speech?: string | null }, options: string[]): number | null {
  const digit = input.digits?.trim();
  if (digit && /^\d$/.test(digit)) {
    const i = Number(digit) - 1;
    return i >= 0 && i < options.length ? i : null;
  }

  const speech = normalize(input.speech ?? "");
  if (!speech) return null;

  // Label match first: "fade" should not be read as an ordinal.
  let best: { index: number; score: number } | null = null;
  options.forEach((label, index) => {
    const words = normalize(label).split(" ").filter((w) => w.length > 2);
    if (!words.length) return;
    const hits = words.filter((w) => speech.includes(w)).length;
    const score = hits / words.length;
    if (hits > 0 && (!best || score > best.score)) best = { index, score };
  });
  if (best) return (best as { index: number }).index;

  for (const token of speech.split(" ")) {
    const n = /^\d$/.test(token) ? Number(token) : NUMBER_WORDS[token];
    if (n && n <= options.length) return n - 1;
  }
  return null;
}

export function isAffirmative(input: { digits?: string | null; speech?: string | null }): boolean | null {
  if (input.digits === "1") return true;
  if (input.digits === "2") return false;
  const s = normalize(input.speech ?? "");
  if (/(^| )(yes|yeah|yep|sure|correct|confirm|ok|okay|please do|კი|დიახ|ხო|ჰო|კარგი)( |$)/u.test(s)) return true;
  if (/(^| )(no|nope|cancel|wrong|different|არა|არ მინდა)( |$)/u.test(s)) return false;
  return null;
}

/** Keypad 0 toggles language; saying the language name picks it. */
export function requestedLanguage(input: { digits?: string | null; speech?: string | null }, current: Locale): Locale | null {
  if (input.digits?.trim() === "0") return current === "ka" ? "en" : "ka";
  const s = normalize(input.speech ?? "");
  if (/(^| )(english|ინგლისურ\p{L}*)( |$)/u.test(s)) return current === "en" ? null : "en";
  if (/(^| )(georgian|ქართულ\p{L}*)( |$)/u.test(s)) return current === "ka" ? null : "ka";
  return null;
}

const NAME_PREFIXES = /^(my name is|my name's|this is|it's|it is|i am|i'm|ჩემი სახელია|სახელად|მე ვარ|მქვია|მოგესალმებით|გამარჯობა)[\s,.!]+/iu;

/** First name from "my name is Nino" / "მე ვარ ნინო" / "ნინო"; null if none. */
export function extractFirstName(speech: string): string | null {
  let rest = speech.replace(/\s+/g, " ").trim();
  // Strip greeting and intro phrases, possibly stacked ("გამარჯობა, მე ვარ ...").
  for (let i = 0; i < 3; i++) rest = rest.replace(/^[\s,.!]+/u, "").replace(NAME_PREFIXES, "");
  const word = rest
    .split(" ")[0]
    ?.replace(/[^\p{L}'-]/gu, "")
    .slice(0, 60);
  if (!word) return null;
  // Georgian has no letter case: toUpperCase() would turn Mkhedruli into
  // Mtavruli ("ნინო" -> "Ნინო"). Capitalize only other scripts.
  if (/\p{Script=Georgian}/u.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

