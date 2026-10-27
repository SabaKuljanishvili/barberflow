import { describe, expect, it } from "vitest";
import { extractFirstName, isAffirmative, matchChoice, requestedLanguage } from "./match";

const services = ["Classic Haircut", "Skin Fade", "Beard Trim"];

describe("matchChoice", () => {
  it("uses keypad digits", () => {
    expect(matchChoice({ digits: "2" }, services)).toBe(1);
    expect(matchChoice({ digits: "9" }, services)).toBeNull();
    expect(matchChoice({ digits: "0" }, services)).toBeNull();
  });
  it("matches spoken labels", () => {
    expect(matchChoice({ speech: "I'd like a skin fade please" }, services)).toBe(1);
    expect(matchChoice({ speech: "Beard." }, services)).toBe(2);
  });
  it("matches spoken numbers and ordinals", () => {
    expect(matchChoice({ speech: "Number three" }, services)).toBe(2);
    expect(matchChoice({ speech: "the first one" }, services)).toBe(0);
    expect(matchChoice({ speech: "2" }, services)).toBe(1);
  });
  it("does not read filler words as numbers", () => {
    expect(matchChoice({ speech: "I want to come in for something" }, services)).toBeNull();
  });
  it("returns null on silence", () => {
    expect(matchChoice({ speech: "" }, services)).toBeNull();
    expect(matchChoice({}, services)).toBeNull();
  });
});

describe("matchChoice in Georgian", () => {
  const kaServices = ["თმის შეჭრა", "წვერის გასწორება", "ბავშვის შეჭრა"];

  it("matches Georgian labels", () => {
    expect(matchChoice({ speech: "წვერის გასწორება მინდა" }, kaServices)).toBe(1);
    expect(matchChoice({ speech: "ბავშვის" }, kaServices)).toBe(2);
  });
  it("matches Georgian numbers, ordinals and their inflected forms", () => {
    expect(matchChoice({ speech: "მეორე" }, kaServices)).toBe(1);
    expect(matchChoice({ speech: "ნომერი სამი" }, kaServices)).toBe(2);
    expect(matchChoice({ speech: "პირველს ავირჩევ" }, kaServices)).toBe(0);
    expect(matchChoice({ speech: "ორზე" }, kaServices)).toBe(1);
    expect(matchChoice({ speech: "3" }, kaServices)).toBe(2);
  });
  it("does not read look-alike words as numbers", () => {
    expect(matchChoice({ speech: "ორშაბათს" }, kaServices)).toBeNull();
  });
});

describe("requestedLanguage", () => {
  it("toggles on keypad 0", () => {
    expect(requestedLanguage({ digits: "0" }, "ka")).toBe("en");
    expect(requestedLanguage({ digits: "0" }, "en")).toBe("ka");
  });
  it("picks a named language, in either language", () => {
    expect(requestedLanguage({ speech: "English please" }, "ka")).toBe("en");
    expect(requestedLanguage({ speech: "ინგლისურად" }, "ka")).toBe("en");
    expect(requestedLanguage({ speech: "ქართულად" }, "en")).toBe("ka");
    expect(requestedLanguage({ speech: "Georgian" }, "ka")).toBeNull();
  });
  it("ignores other input", () => {
    expect(requestedLanguage({ digits: "1" }, "ka")).toBeNull();
    expect(requestedLanguage({ speech: "თმის შეჭრა" }, "ka")).toBeNull();
  });
});

describe("extractFirstName", () => {
  it.each([
    ["my name is nino", "Nino"],
    ["I'm Giorgi.", "Giorgi"],
    ["მე ვარ ნინო", "ნინო"],
    ["გამარჯობა, ჩემი სახელია ლუკა", "ლუკა"],
    ["მქვია ანა", "ანა"],
    ["დავითი", "დავითი"],
    ["", null],
  ])("%s -> %s", (speech, expected) => {
    expect(extractFirstName(speech)).toBe(expected);
  });
});

describe("isAffirmative", () => {
  it.each([
    [{ speech: "Yes please" }, true],
    [{ speech: "nope" }, false],
    [{ digits: "1" }, true],
    [{ digits: "2" }, false],
    [{ speech: "hmm" }, null],
    [{ speech: "კი, დიახ" }, true],
    [{ speech: "არა" }, false],
  ])("%o -> %s", (input, expected) => {
    expect(isAffirmative(input)).toBe(expected);
  });
});

describe("parseReply", async () => {
  const { parseReply } = await import("../sms");
  it.each([
    ["C", "confirmed"],
    ["yes see you then", "confirmed"],
    [" x ", "cancelled"],
    ["CANCEL", "cancelled"],
    ["what time?", null],
    ["კი", "confirmed"],
    ["დიახ, მოვალ", "confirmed"],
    ["არა", "cancelled"],
    ["გაუქმება", "cancelled"],
  ])("%s -> %s", (body, expected) => {
    expect(parseReply(body)).toBe(expected);
  });
});
