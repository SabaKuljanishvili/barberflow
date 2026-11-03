import "server-only";
import { z } from "zod";
import { formatIssues } from "./env";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Twilio and Azure Speech are optional and parsed on their own in
// env-sections.ts (twilioConfig / azureConfig), so a malformed value there
// switches off only that feature instead of throwing here.
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  CRON_SECRET: z.string().min(32, "use at least 32 random characters"),
  BUSINESS_LEGAL_NAME: optional,
  BUSINESS_EMAIL: optional,
  BUSINESS_PHONE: optional,
  BUSINESS_STREET: optional,
  BUSINESS_CITY: optional,
  BUSINESS_REGION: optional,
  BUSINESS_POSTAL_CODE: optional,
  BUSINESS_COUNTRY: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Validated server env. Throws with every invalid key listed. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables: ${formatIssues(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}

/** Business details only; safe to call when the rest of the env is absent. */
export function businessDetails() {
  const pick = (k: string) => {
    const v = process.env[k]?.trim();
    return v ? v : undefined;
  };
  return {
    legalName: pick("BUSINESS_LEGAL_NAME"),
    email: pick("BUSINESS_EMAIL"),
    phone: pick("BUSINESS_PHONE"),
    street: pick("BUSINESS_STREET"),
    city: pick("BUSINESS_CITY"),
    region: pick("BUSINESS_REGION"),
    postalCode: pick("BUSINESS_POSTAL_CODE"),
    country: pick("BUSINESS_COUNTRY"),
  };
}
