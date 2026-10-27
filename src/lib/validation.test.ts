import { describe, expect, it } from "vitest";
import { money, spokenMoney } from "./format";
import { splitE164 } from "./phone-countries";
import { en } from "@/i18n/dictionaries/en";
import { ka } from "@/i18n/dictionaries/ka";
import { bookingClientSchema, normalizePhone, parseIn, passwordSchema, salonSettingsSchema, sanitizeText, serviceSchema, signupSchema, toFormState, withDateTime, withDialCode, withTime } from "./validation";

describe("localized errors", () => {
  it("translates custom message keys", () => {
    const r = parseIn(passwordSchema, "short", "ka");
    if (r.success) throw new Error("expected failure");
    const state = toFormState(r.error, ka.validation);
    expect(state?.message).toBe(ka.validation.fixFields);
    expect(state?.fieldErrors?.form).toContain(ka.validation.passwordMin);
  });
  it("uses Zod's Georgian messages for built-in checks", () => {
    const r = parseIn(serviceSchema, { name: "", price: "10", durationMinutes: "30" }, "ka");
    if (r.success) throw new Error("expected failure");
    const msg = toFormState(r.error, ka.validation)?.fieldErrors?.name?.[0] ?? "";
    expect(msg).toMatch(/\p{Script=Georgian}/u);
    const enResult = parseIn(serviceSchema, { name: "", price: "10", durationMinutes: "30" }, "en");
    if (enResult.success) throw new Error("expected failure");
    expect(toFormState(enResult.error, en.validation)?.fieldErrors?.name?.[0]).toMatch(/^[\x20-\x7e]+$/);
  });
});

describe("money", () => {
  it("formats lari", () => {
    expect(money(25)).toBe("25.00 ₾");
    expect(money("1234.5")).toBe("1,234.50 ₾");
    expect(spokenMoney(25)).toBe("25 lari");
    expect(spokenMoney("12.5")).toBe("12.50 lari");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["+1 (555) 123-4567", "+15551234567"],
    ["555-123-4567", "+15551234567"],
    ["15551234567", "+15551234567"],
    ["0044 20 7946 0958", "+442079460958"],
    ["+44 20 7946 0958", "+442079460958"],
    ["599 12 34 56", "+995599123456"],
    ["+995 599 12 34 56", "+995599123456"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("withDialCode", () => {
  const fd = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };

  it.each([
    [{ phone: "599 12 34 56", phoneCountry: "GE" }, "+995599123456"],
    [{ phone: "0599123456", phoneCountry: "GE" }, "+995599123456"],
    [{ phone: "20 7946 0958", phoneCountry: "GB" }, "+442079460958"],
    [{ phone: "+1 555 123 4567", phoneCountry: "GE" }, "+1 555 123 4567"],
    [{ phone: "", phoneCountry: "GE" }, ""],
    [{ phone: "599123456", phoneCountry: "XX" }, "599123456"],
  ])("%o -> %s", (entries, expected) => {
    expect(withDialCode(fd(entries), "phone")).toBe(expected);
  });

  it("returns undefined when the field is absent", () => {
    expect(withDialCode(fd({}), "phone")).toBeUndefined();
  });
});

describe("splitE164", () => {
  it.each([
    ["+995599123456", { iso: "GE", national: "599123456" }],
    ["+442079460958", { iso: "GB", national: "2079460958" }],
    [null, { iso: "GE", national: "" }],
  ])("%s", (input, expected) => {
    expect(splitE164(input)).toEqual(expected);
  });

  it.each(["", "12345", "+0123456789", "abc"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("sanitizeText", () => {
  it("strips control characters and collapses whitespace", () => {
    expect(sanitizeText("  Skin\u0000  fade\n\t ")).toBe("Skin fade");
  });
});

describe("signupSchema", () => {
  const valid = { fullName: "Ana Ruiz", salonName: "Ruiz Cuts", email: "ana@example.com", password: "Sup3rsecret!", acceptTerms: "on" };

  it("accepts valid input", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });
  it("requires terms consent", () => {
    const r = signupSchema.safeParse({ ...valid, acceptTerms: undefined });
    expect(r.success).toBe(false);
  });
  it("enforces password strength", () => {
    expect(signupSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "alllowercase1" }).success).toBe(false);
  });
  it("does not let markup through unchanged length limits", () => {
    expect(signupSchema.safeParse({ ...valid, salonName: "x".repeat(121) }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("coerces form strings", () => {
    const r = serviceSchema.parse({ name: "Fade", price: "35.50", durationMinutes: "45" });
    expect(r).toEqual({ name: "Fade", price: 35.5, durationMinutes: 45 });
  });
  it("rejects fractional cents and silly durations", () => {
    expect(serviceSchema.safeParse({ name: "Fade", price: "35.555", durationMinutes: "45" }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: "Fade", price: "35", durationMinutes: "2" }).success).toBe(false);
  });
});

describe("salonSettingsSchema", () => {
  const valid = { name: "Ruiz Cuts", timezone: "America/Chicago", opensAt: "09:00", closesAt: "18:00", workingDays: ["1", "2"], locale: "ka" };
  it("accepts valid settings and an empty phone", () => {
    const r = salonSettingsSchema.parse({ ...valid, phoneNumber: "" });
    expect(r.phoneNumber).toBeUndefined();
    expect(r.workingDays).toEqual([1, 2]);
  });
  it("rejects unknown timezones and inverted hours", () => {
    expect(salonSettingsSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(salonSettingsSchema.safeParse({ ...valid, opensAt: "19:00" }).success).toBe(false);
  });
  it("rejects unsupported languages", () => {
    expect(salonSettingsSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });
});

describe("withTime / withDateTime", () => {
  const fd = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };
  it("joins 24-hour parts", () => {
    expect(withTime(fd({ opensAtHour: "09", opensAtMinute: "30" }), "opensAt")).toBe("09:30");
    expect(withDateTime(fd({ localTimeDate: "2026-11-02", localTimeHour: "17", localTimeMinute: "45" }), "localTime")).toBe("2026-11-02T17:45");
  });
  it("returns undefined when a part is missing", () => {
    expect(withTime(fd({ opensAtHour: "09" }), "opensAt")).toBeUndefined();
    expect(withDateTime(fd({ localTimeHour: "17", localTimeMinute: "45" }), "localTime")).toBeUndefined();
  });
});

describe("bookingClientSchema", () => {
  it("splits the name and normalizes the phone", () => {
    expect(bookingClientSchema.parse({ clientName: "  ნინო  ბერიძე ", phoneNumber: "+995 599 12 34 56" })).toEqual({
      firstName: "ნინო",
      lastName: "ბერიძე",
      phoneNumber: "+995599123456",
    });
    expect(bookingClientSchema.parse({ clientName: "Giorgi", phoneNumber: "+995599123456" }).lastName).toBe("");
  });
  it("requires a name and a valid phone", () => {
    expect(bookingClientSchema.safeParse({ clientName: "", phoneNumber: "+995599123456" }).success).toBe(false);
    expect(bookingClientSchema.safeParse({ clientName: "Nino", phoneNumber: "123" }).success).toBe(false);
  });
});
