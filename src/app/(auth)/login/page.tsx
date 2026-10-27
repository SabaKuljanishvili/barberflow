import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.login.title, description: t.auth.login.description, alternates: { canonical: "/login" } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmed?: string; error?: string }> }) {
  const { next, confirmed, error } = await searchParams;
  const { t } = await getI18n();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.auth.login.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.auth.login.intro}</p>
      {confirmed && (
        <p role="status" className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {t.auth.login.confirmed}
        </p>
      )}
      {error === "link" && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger">
          {t.auth.login.badLink}
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}
