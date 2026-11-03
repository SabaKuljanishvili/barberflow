import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RESET_COOKIE, destinationFor, grantsPasswordReset } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Target of every Supabase email link: signup confirmation, staff invites,
// password recovery and email change.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Default Supabase templates ({{ .ConfirmationURL }}) land here with a PKCE
  // code instead of a token_hash. The recovery email's redirectTo carries
  // next=/reset-password, so the type is not needed here.
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return land(request, null, next);
  }

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return land(request, type, next);
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}

/**
 * Redirects to the link's destination. A recovery or invite link also gets a
 * short-lived marker cookie: /reset-password requires it, so a session alone
 * (stolen cookie, unlocked shared PC) can't set a new password there.
 */
function land(request: NextRequest, type: EmailOtpType | null, next: string | null) {
  const res = NextResponse.redirect(new URL(destinationFor(type, next), request.url));
  if (grantsPasswordReset(type, next)) {
    res.cookies.set(RESET_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 15 * 60 });
  }
  return res;
}
