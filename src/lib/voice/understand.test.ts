import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { describeTurn, toUnderstanding, understand } = await import("./understand");

const facts = {
  salon: { name: "BarberFlow Tbilisi", opens_at: "10:00:00", closes_at: "20:00:00", working_days: [1, 2, 3, 4, 5, 6] },
  services: [
    { name: "თმის შეჭრა", price: 25, duration_minutes: 30 },
    { name: "წვერის მოწესრიგება", price: 15, duration_minutes: 20 },
  ],
  barbers: [{ full_name: "გიორგი" }],
};

describe("describeTurn", () => {
  it("gives the salon facts, the numbered menu and the speech", () => {
    const text = describeTurn(facts, "ka", "რომელი სერვისი გსურთ?", ["თმის შეჭრა", "წვერის მოწესრიგება"], "წვერი მინდა");
    expect(text).toContain("Call language: ka-GE");
    expect(text).toContain("ორშაბათი, სამშაბათი, ოთხშაბათი, ხუთშაბათი, პარასკევი, შაბათი, 10:00-20:00");
    expect(text).not.toContain("კვირა");
    expect(text).toContain("- თმის შეჭრა: 25 lari, 30 minutes");
    expect(text).toContain("2. წვერის მოწესრიგება");
    expect(text).toContain("<caller_said>წვერი მინდა</caller_said>");
  });
});

describe("toUnderstanding", () => {
  it("turns a 1-based option into an index", () => {
    expect(toUnderstanding({ kind: "choice", option: 2, answer: null }, 3)).toEqual({ kind: "choice", index: 1 });
  });

  it("rejects options out of range", () => {
    expect(toUnderstanding({ kind: "choice", option: 4, answer: null }, 3)).toEqual({ kind: "unclear" });
    expect(toUnderstanding({ kind: "choice", option: 0, answer: null }, 3)).toEqual({ kind: "unclear" });
    expect(toUnderstanding({ kind: "choice", option: null, answer: null }, 3)).toEqual({ kind: "unclear" });
  });

  it("keeps a question's answer, trimmed and capped", () => {
    expect(toUnderstanding({ kind: "question", option: null, answer: "  შეჭრა 25 ლარი ღირს. " }, 2)).toEqual({
      kind: "question",
      answer: "შეჭრა 25 ლარი ღირს.",
    });
    const long = toUnderstanding({ kind: "question", option: null, answer: "სიტყვა ".repeat(80) }, 2);
    expect(long.kind === "question" && long.answer.length).toBeLessThanOrEqual(301);
  });

  it("treats an empty answer or no output as unclear", () => {
    expect(toUnderstanding({ kind: "question", option: null, answer: " " }, 2)).toEqual({ kind: "unclear" });
    expect(toUnderstanding(null, 2)).toEqual({ kind: "unclear" });
  });

  it("drops answers with scripts TTS can't read", () => {
    expect(toUnderstanding({ kind: "question", option: null, answer: "क्षमოდით, ვერ დაგეხმარებით." }, 2)).toEqual({ kind: "unclear" });
    expect(toUnderstanding({ kind: "question", option: null, answer: "Haircut is 25 lari — ჩვენთან." }, 2).kind).toBe("question");
  });
});

describe("understand", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("doesn't call the API without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const heard = await understand({ facts, locale: "ka", menuPrompt: "?", options: ["a"], speech: "პირველი" });
    expect(heard).toEqual({ kind: "unclear" });
  });
});
