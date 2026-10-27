import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signup.title, description: t.auth.signup.description, alternates: { canonical: "/signup" } };
}

export default async function SignupPage() {
  const { t } = await getI18n();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t.auth.signup.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.auth.signup.intro}</p>
      <SignupForm />
    </>
  );
}
