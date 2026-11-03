import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getI18n } from "@/i18n/server";
import { RESET_COOKIE } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.reset.title, description: t.auth.reset.description, robots: { index: false } };
}

// Reached from the recovery or invite email via /auth/confirm, which has
// already exchanged the link for a session.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const { t } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const allowed = Boolean(data?.claims.sub) && (await cookies()).get(RESET_COOKIE)?.value === "1";

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.auth.reset.title}</h1>
      {allowed ? (
        <>
          <p className="mt-1 text-sm text-muted">{invite ? t.auth.reset.inviteIntro : t.auth.reset.intro}</p>
          <ResetForm />
        </>
      ) : (
        <>
          <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {t.auth.reset.expired}
          </p>
          <Link href="/forgot-password" className="btn-primary mt-6 w-full">
            {t.auth.reset.requestNew}
          </Link>
        </>
      )}
    </>
  );
}
