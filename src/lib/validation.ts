import { z } from "zod";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { phoneCountry } from "./phone-countries";

// Custom messages are keys of Dictionary["validation"]; toFormState translates
// them. Zod's own messages (too short, too long...) come from its locale packs.
type MessageKey = keyof Dictionary["validation"];
const m = (key: MessageKey) => key;

// Strip control characters and collapse whitespace. React escapes on output,
// so this is about clean storage, not the only XSS defence.
export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

const text = (min: number, max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().min(min).max(max));

/**
 * Normalizes to E.164. Bare 9-digit numbers are assumed Georgian, bare
 * 10-digit numbers North American.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (trimmed.startsWith("00")) e164 = `+${digits.slice(2)}`;
  else if (digits.length === 9) e164 = `+995${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

/**
 * Joins a PhoneField's country select (`${name}Country`) with the typed
 * number. A number typed with its own + or 00 prefix wins; a national trunk
 * 0 is dropped. Returns undefined when the field is absent.
 */
export function withDialCode(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value || value.startsWith("+") || value.startsWith("00")) return value;
  const country = phoneCountry(String(formData.get(`${name}Country`) ?? ""));
  if (!country) return value;
  return `+${country.dial}${value.replace(/\D/g, "").replace(/^0+/, "")}`;
}

/**
 * Joins the hour and minute selects of a TimeField (`${name}Hour`,
 * `${name}Minute`) into "HH:MM". Returns undefined if either is absent.
 */
export function withTime(formData: FormData, name: string): string | undefined {
  const h = formData.get(`${name}Hour`);
  const min = formData.get(`${name}Minute`);
  if (typeof h !== "string" || typeof min !== "string") return undefined;
  return `${h}:${min}`;
}

/** Joins a DateTimeField (`${name}Date` plus TimeField parts) into "YYYY-MM-DDTHH:MM". */
export function withDateTime(formData: FormData, name: string): string | undefined {
  const date = formData.get(`${name}Date`);
  const time = withTime(formData, name);
  if (typeof date !== "string" || !time) return undefined;
  return `${date}T${time}`;
}

export const phoneSchema = z.string().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) {
    ctx.addIssue({ code: "custom", message: m("phone") });
    return z.NEVER;
  }
  return n;
});

const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined))
  .pipe(phoneSchema.optional());

export const passwordSchema = z
  .string()
  .min(10, m("passwordMin"))
  .max(72, m("passwordMax"))
  .regex(/[a-z]/, m("passwordLower"))
  .regex(/[A-Z]/, m("passwordUpper"))
  .regex(/\d/, m("passwordDigit"));

export const loginSchema = z.object({
  email: z.email(m("email")).max(254),
  password: z.string().min(1, m("passwordRequired")).max(72),
});

export const signupSchema = z.object({
  fullName: text(1, 120),
  salonName: text(2, 120),
  email: z.email(m("email")).max(254),
  password: passwordSchema,
  acceptTerms: z.literal("on", { error: m("acceptTerms") }),
});

export const serviceSchema = z.object({
  name: text(1, 80),
  price: z.coerce.number().min(0).max(100_000).multipleOf(0.01, m("decimals")),
  durationMinutes: z.coerce.number().int().min(5).max(480),
});

export const clientSchema = z.object({
  firstName: text(1, 60),
  lastName: text(0, 60),
  phoneNumber: phoneSchema,
});

export const appointmentSchema = z.object({
  // Empty means "any available barber"; the server picks one.
  staffId: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.uuid().optional()),
  serviceId: z.uuid(),
  // "YYYY-MM-DDTHH:MM" in the salon's timezone, from withDateTime().
  localTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, m("dateTime")),
});

// The booking form takes a name and phone; the server matches the client by
// phone or creates one. First word is the first name, the rest the last name.
export const bookingClientSchema = z
  .object({ clientName: text(1, 120), phoneNumber: phoneSchema })
  .transform(({ clientName, phoneNumber }) => {
    const [first, ...rest] = clientName.split(" ");
    return { firstName: first.slice(0, 60), lastName: rest.join(" ").slice(0, 60), phoneNumber };
  });

export const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
});

export const inviteSchema = z.object({
  fullName: text(1, 120),
  email: z.email(m("email")).max(254),
  phone: optionalPhone,
});

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, m("timeOfDay"));

export const salonSettingsSchema = z
  .object({
    name: text(2, 120),
    phoneNumber: optionalPhone,
    timezone: z.string().refine(isValidTimeZone, m("timezone")),
    opensAt: timeOfDay,
    closesAt: timeOfDay,
    workingDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, m("workingDays")),
    voiceAgentEnabled: z.literal("on").optional(),
    locale: z.enum(["ka", "en"], m("language")),
  })
  .refine((v) => v.closesAt > v.opensAt, { path: ["closesAt"], message: m("closesAfterOpens") });

export const passwordChangeSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: m("passwordsMatch") });

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type FormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

const ZOD_LOCALES: Record<Locale, z.core.$ZodErrorMap> = { ka: z.locales.ka().localeError, en: z.locales.en().localeError };

/** safeParse with Zod's built-in messages in the given language. */
export function parseIn<T extends z.ZodType>(schema: T, data: unknown, locale: Locale) {
  return schema.safeParse(data, { error: ZOD_LOCALES[locale] });
}

export function toFormState(error: z.ZodError, messages: Dictionary["validation"]): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    const text = issue.message in messages ? messages[issue.message as MessageKey] : issue.message;
    (fieldErrors[key] ??= []).push(text);
  }
  return { ok: false, message: messages.fixFields, fieldErrors };
}
