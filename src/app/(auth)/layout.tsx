import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { getI18n } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <Logo />
        <LocaleSwitcher />
      </div>
      <main id="main" tabIndex={-1} className="card mt-8 w-full max-w-md p-8">
        {children}
      </main>
      <p className="mt-6 text-sm text-muted">
        <Link href="/legal/privacy" className="hover:text-brand-700">
          {t.auth.privacy}
        </Link>
        {" · "}
        <Link href="/legal/terms" className="hover:text-brand-700">
          {t.auth.terms}
        </Link>
      </p>
    </div>
  );
}
