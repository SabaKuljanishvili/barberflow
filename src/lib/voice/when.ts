// Finds a requested day and time in free speech, Georgian or English:
// "ხვალ ორ საათზე" (tomorrow at 2), "პარასკევს 15:30", "ორის ნახევარზე"
// (1:30, Georgian counts half towards the next hour), "tomorrow at 2 pm".
// Deterministic on purpose: the time decides which slot is booked, so it is
// never left to the LLM. Pure; resolveWhen needs only the salon's hours.

import { zonedParts, zonedToUtc } from "@/lib/time";

export type WhenRequest = {
  /** Days from today, or an ISO weekday (1 = Monday) for the next such day. */
  day: { offset: number } | { weekday: number } | null;
  /** Hour as said (may be 12-hour), and minute. */
  time: { hour: number; minute: number } | null;
  meridiem: "am" | "pm" | null;
};

const DAY_WORDS: Record<string, number> = {
  დღეს: 0, ხვალ: 1, ხვალე: 1, ხვალისთვის: 1, ზეგ: 2, ზეგე: 2, ზეგისთვის: 2,
  today: 0, tonight: 0, tomorrow: 1,
};

// Stems; any inflection (ორშაბათს, ორშაბათისთვის) matches by prefix.
const WEEKDAY_STEMS: [string, number][] = [
  ["ორშაბათ", 1], ["სამშაბათ", 2], ["ოთხშაბათ", 3], ["ხუთშაბათ", 4], ["პარასკევ", 5], ["შაბათ", 6], ["კვირ", 7],
  ["monday", 1], ["tuesday", 2], ["wednesday", 3], ["thursday", 4], ["friday", 5], ["saturday", 6], ["sunday", 7],
];

const AM_WORDS = new Set(["დილის", "დილით", "დილას", "am", "morning"]);
const PM_WORDS = new Set(["საღამოს", "შუადღის", "შუადღეს", "ნაშუადღევს", "ღამის", "pm", "afternoon", "evening"]);

// Georgian cardinals 1-12 by stem. The suffixes cover "ორი", "ორ საათზე",
// "ორზე", "ორის ნახევარზე", "ორისთვის".
const KA_HOURS: [string, number][] = [
  ["ერთ", 1], ["პირველ", 1], ["ორ", 2], ["სამ", 3], ["ოთხ", 4], ["ხუთ", 5], ["ექვს", 6], ["შვიდ", 7],
  ["რვ", 8], ["ცხრ", 9], ["ათ", 10], ["თერთმეტ", 11], ["თორმეტ", 12],
];
const EN_HOURS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, noon: 12,
};

const MINUTE_WORDS: Record<string, number> = { fifteen: 15, thirty: 30, "15": 15, "30": 30, "45": 45 };

type Num = { n: number; genitive: boolean; at: boolean };

/** Reads one token as an hour number: "2", "14", "ორ", "ორზე", "ორის", "two". */
function hourNumber(token: string): Num | null {
  const digits = token.match(/^(\d{1,2})(ზე|ის|-ზე)?$/u);
  if (digits) {
    const n = Number(digits[1]);
    return n <= 23 ? { n, genitive: digits[2] === "ის", at: digits[2] === "ზე" } : null;
  }
  if (token in EN_HOURS) return { n: EN_HOURS[token], genitive: false, at: false };
  for (const [stem, n] of KA_HOURS) {
    if (!token.startsWith(stem)) continue;
    const suffix = token.slice(stem.length);
    // რვა / ცხრა keep their vowel: რვა, რვაზე, რვის.
    const forms: Record<string, { genitive: boolean; at: boolean }> = {
      "": { genitive: false, at: false },
      ი: { genitive: false, at: false },
      ა: { genitive: false, at: false },
      ზე: { genitive: false, at: true },
      აზე: { genitive: false, at: true },
      იზე: { genitive: false, at: true },
      ის: { genitive: true, at: false },
      ისთვის: { genitive: true, at: true },
    };
    const form = forms[suffix];
    if (form) return { n, ...form };
  }
  return null;
}

function normalize(speech: string): string[] {
  return speech
    .toLowerCase()
    .replace(/(\d)\s*(am|pm)\b/g, "$1 $2")
    .replace(/[^\p{L}\p{N}:\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Pulls a day/time request out of `speech`. `rest` is the speech without the
 * words that were used, so "ხვალ ორზე" can't also be read as "option 2".
 */
export function parseWhen(speech: string): { when: WhenRequest | null; rest: string } {
  const tokens = normalize(speech);
  const used = new Set<number>();
  const when: WhenRequest = { day: null, time: null, meridiem: null };

  tokens.forEach((tok, i) => {
    if (tok in DAY_WORDS) {
      // "day after tomorrow"
      if (tok === "tomorrow" && tokens[i - 1] === "after" && tokens[i - 2] === "day") {
        when.day = { offset: 2 };
        used.add(i - 2).add(i - 1).add(i);
      } else {
        when.day = { offset: DAY_WORDS[tok] };
        used.add(i);
      }
      return;
    }
    const weekday = WEEKDAY_STEMS.find(([stem]) => tok.startsWith(stem));
    if (weekday) {
      when.day = { weekday: weekday[1] };
      used.add(i);
      return;
    }
    if (AM_WORDS.has(tok)) {
      when.meridiem = "am";
      used.add(i);
    } else if (PM_WORDS.has(tok)) {
      when.meridiem = "pm";
      used.add(i);
    }
  });

  for (let i = 0; i < tokens.length && !when.time; i++) {
    if (used.has(i)) continue;
    const tok = tokens[i];
    const next = tokens[i + 1] ?? "";

    const clock = tok.match(/^(\d{1,2}):(\d{2})(ზე)?$/u);
    if (clock && Number(clock[1]) <= 23 && Number(clock[2]) <= 59) {
      when.time = { hour: Number(clock[1]), minute: Number(clock[2]) };
      used.add(i);
      continue;
    }

    // English: "half past two"
    if (tok === "half" && next === "past") {
      const n = hourNumber(tokens[i + 2] ?? "");
      if (n) {
        when.time = { hour: n.n, minute: 30 };
        used.add(i).add(i + 1).add(i + 2);
      }
      continue;
    }

    const num = hourNumber(tok);
    if (!num) continue;
    // "14-ზე" arrives as "14 ზე".
    if (next === "ზე") {
      num.at = true;
      used.add(i + 1);
    }

    // Georgian half hours: "ორის ნახევარზე" is 1:30.
    if (num.genitive && next.startsWith("ნახევარ")) {
      when.time = { hour: num.n === 1 ? 12 : num.n - 1, minute: 30 };
      used.add(i).add(i + 1);
      continue;
    }
    // "ორ საათზე", "ორი საათისთვის", "ორ საათსა და ნახევარზე"
    if (next.startsWith("საათ")) {
      const half = tokens[i + 2] === "და" && tokens[i + 3]?.startsWith("ნახევარ");
      when.time = { hour: num.n, minute: half ? 30 : 0 };
      used.add(i).add(i + 1);
      if (half) used.add(i + 2).add(i + 3);
      continue;
    }
    // English: "at 2", "2 o'clock", "2 pm", "two thirty"
    const prev = tokens[i - 1];
    const minute = num.n <= 12 ? (MINUTE_WORDS[next] ?? 0) : 0;
    if (prev === "at" || (next === "o" && tokens[i + 2] === "clock") || next === "am" || next === "pm" || minute) {
      when.time = { hour: num.n, minute };
      used.add(i);
      if (prev === "at") used.add(i - 1);
      if (next === "o") used.add(i + 1).add(i + 2);
      if (minute) used.add(i + 1);
      continue;
    }
    // "ორზე" alone is only a time when a day or part of day was said too:
    // otherwise it could be a menu answer ("the second one").
    if ((num.at || /^\d{1,2}$/.test(tok)) && (when.day || when.meridiem) && num.n <= 23) {
      when.time = { hour: num.n, minute: 0 };
      used.add(i);
    }
  }

  const rest = tokens.filter((_, i) => !used.has(i)).join(" ");
  return { when: when.day || when.time ? when : null, rest };
}

export type SalonHours = { timeZone: string; opensAt: string; closesAt: string };

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** 12-hour speech to 24-hour: an unmarked "2" in a salon open 10-20 is 14:00. */
export function toHour24(hour: number, minute: number, meridiem: WhenRequest["meridiem"], hours: Pick<SalonHours, "opensAt" | "closesAt">): number {
  if (hour > 12) return hour;
  if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  const open = minutesOf(hours.opensAt);
  const close = minutesOf(hours.closesAt);
  const inside = (h: number) => h * 60 + minute >= open && h * 60 + minute < close;
  if (inside(hour)) return hour;
  if (hour < 12 && inside(hour + 12)) return hour + 12;
  // Outside opening hours either way: assume the afternoon for small numbers.
  return hour < 8 ? hour + 12 : hour;
}

/**
 * The instant the client asked for, in the salon's timezone. `exact` is false
 * when only a day was given (the search then starts at opening time).
 */
export function resolveWhen(req: WhenRequest, now: Date, hours: SalonHours): { start: Date; exact: boolean } {
  const today = zonedParts(now, hours.timeZone);
  const nowMinutes = today.hour * 60 + today.minute;
  const hour = req.time ? toHour24(req.time.hour, req.time.minute, req.meridiem, hours) : null;
  const wanted = hour === null ? null : hour * 60 + (req.time?.minute ?? 0);

  let offset: number;
  if (!req.day) offset = wanted !== null && wanted <= nowMinutes ? 1 : 0;
  else if ("offset" in req.day) offset = req.day.offset;
  else {
    offset = (req.day.weekday - today.weekday + 7) % 7;
    // "Monday" said on a Monday means today only if that time is still ahead.
    if (offset === 0 && (wanted === null || wanted <= nowMinutes)) offset = 7;
  }

  const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
  const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
  if (wanted === null) {
    const open = minutesOf(hours.opensAt);
    return { start: zonedToUtc(y, m, d, Math.floor(open / 60), open % 60, hours.timeZone), exact: false };
  }
  return { start: zonedToUtc(y, m, d, Math.floor(wanted / 60), wanted % 60, hours.timeZone), exact: true };
}
