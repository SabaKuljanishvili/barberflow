import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/** Per-request client bound to the signed-in user's session. RLS applies. */
export async function createSupabaseServerClient() {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Checks an email/password pair without touching the request's session
 * cookies (anon key, nothing persisted). Used to re-authenticate before a
 * password change; the throwaway session is signed out right away.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const env = publicEnv();
  const probe = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}

/**
 * Service-role client. Bypasses RLS, so every query MUST scope by salon_id
 * explicitly. Only for webhooks, cron jobs and manager-authorized admin tasks.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
