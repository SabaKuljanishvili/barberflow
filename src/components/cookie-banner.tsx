"use client";

import Link from "@/components/locale-link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";

const COOKIE = "bf_cookie_consent";

// DevskStudio sets only strictly necessary cookies (sign-in session,
// language, this notice), so no consent is needed: this is a small,
// dismissible notice, not a consent banner. Nothing optional ever loads.
export function CookieBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reading document.cookie must happen after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`)));
  }, []);

  function dismiss() {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=seen; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <section
      role="region"
      aria-label={t.cookies.region}
      className="fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-line bg-surface py-2 pr-2 pl-4 text-sm text-muted shadow-soft sm:max-w-md"
    >
      <p>
        {t.cookies.body}{" "}
        <Link href="/legal/cookies" className="font-medium text-accent underline underline-offset-2">
          {t.cookies.policy}
        </Link>
      </p>
      <button type="button" onClick={dismiss} className="btn-secondary shrink-0 px-3 py-1.5" aria-label={t.cookies.dismiss}>
        <X aria-hidden="true" className="size-4 sm:hidden" />
        <span className="hidden sm:inline">{t.cookies.dismiss}</span>
      </button>
    </section>
  );
}
