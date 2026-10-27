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
 * Resolves the verified user (getUser() re-validates the JWT with Supabase,
 * unlike getSession()) plus their profile and salon. Cached per request.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;

  const { data: salon } = await supabase.from("salons").select("*").eq("id", profile.salon_id).single();
  if (!salon) return null;

  return { userId: user.id, profile, salon, isManager: profile.role === "manager" };
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
