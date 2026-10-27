import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Target of Supabase email links (signup confirmation and staff invites).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Default Supabase templates ({{ .ConfirmationURL }}) land here with a PKCE
  // code instead of a token_hash. Free-tier projects cannot edit templates.
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Invited barbers and password recovery land on settings to set a password.
      const dest = type === "invite" || type === "recovery" ? "/dashboard/account?setPassword=1" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
