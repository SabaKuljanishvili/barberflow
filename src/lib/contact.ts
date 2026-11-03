import { z } from "zod";
import { sanitizeText } from "./validation";

// Public contact form (/contact). Pure parts only; sending is in
// app/(marketing)/contact/actions.ts.

const line = (min: number, max: number) => z.string().transform(sanitizeText).pipe(z.string().min(min).max(max));

export const contactSchema = z
  .object({
    name: line(1, 120),
    email: z.email("email").max(254),
    salon: z
      .string()
      .optional()
      .transform((v) => (v ? sanitizeText(v) : ""))
      .pipe(z.string().max(120))
      .transform((v) => v || undefined),
    // Keep line breaks in the message; strip other control characters.
    message: z
      .string()
      .transform((v) => v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim())
      .pipe(z.string().min(10).max(4000)),
    // Honeypot: hidden from people, filled by naive bots.
    website: z.string().optional(),
  })
  .transform(({ website, ...rest }) => ({ ...rest, bot: Boolean(website?.trim()) }));

export type ContactMessage = z.output<typeof contactSchema>;

export function buildContactEmail(m: ContactMessage) {
  const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  return {
    subject: oneLine(`DevskStudio contact: ${m.name}${m.salon ? ` (${m.salon})` : ""}`).slice(0, 200),
    reply_to: m.email,
    text: [`Name: ${oneLine(m.name)}`, `Email: ${m.email}`, `Salon: ${m.salon ? oneLine(m.salon) : "-"}`, "", m.message].join("\n"),
  };
}
