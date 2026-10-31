import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type SessionContext = {
  userId: string;
  profile: Tables<"profiles">;
  salon: Tables<"salons">;
  isManager: boolean;
};

/**
 * Resolves the verified user plus their profile and salon. Cached per request.
 * getClaims() verifies the JWT signature (locally with asymmetric signing
 * keys, else via the Auth server like getUser()), unlike getSession().
 * Profile and salon come back in one joined query.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: row } = await supabase.from("profiles").select("*, salons(*)").eq("id", userId).maybeSingle();
  if (!row?.salons) return null;

  const { salons: salon, ...profile } = row;
  return { userId, profile, salon, isManager: profile.role === "manager" };
});

export async function requireUser(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireManager(): Promise<SessionContext> {
  const session = await requireUser();
  if (!session.isManager) redirect("/dashboard?error=forbidden");
  return session;
}
