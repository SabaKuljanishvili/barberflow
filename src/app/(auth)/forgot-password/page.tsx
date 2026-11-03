import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgot.title, description: t.auth.forgot.description, alternates: { canonical: "/forgot-password" }, robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.auth.forgot.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.auth.forgot.intro}</p>
      <ForgotForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-medium text-accent underline underline-offset-2">
          {t.auth.forgot.back}
        </Link>
      </p>
    </>
  );
}
