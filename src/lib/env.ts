import { z } from "zod";

// Public values are inlined into the client bundle at build time, so each one
// must be referenced by its full literal name.
const publicSchema = z.object({
  // Read the origin with siteUrl(); this raw value may carry a stray path.
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment variables: ${formatIssues(parsed.error)}`);
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

function originOf(value: string | undefined, scheme = ""): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    return new URL(scheme + v).origin;
  } catch {
    return null;
  }
}

/**
 * Public site origin, never with a path or trailing slash. The env value once
 * ended in "/login", which put every canonical, OG image and sitemap URL
 * under /login/. Falls back to Vercel's system variables, then localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  return (
    originOf(env.NEXT_PUBLIC_SITE_URL) ??
    originOf(env.VERCEL_PROJECT_PRODUCTION_URL, "https://") ??
    originOf(env.VERCEL_URL, "https://") ??
    "http://localhost:3000"
  );
}

/** Single source for every absolute URL: metadataBase, sitemap, robots, JSON-LD, email links, webhooks. */
export function siteUrl(): string {
  return resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}

export function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}
