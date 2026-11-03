import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where requireUser() sends a valid login that has no active profile (salon
// deleted, member removed or deactivated). Signing out here breaks the
// /login <-> /dashboard redirect loop. Someone who still has access is sent
// back, so a cross-site link can't sign people out.
export async function GET(request: NextRequest) {
  if (await getSession()) return NextResponse.redirect(new URL("/dashboard", request.url));
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=access", request.url));
}
