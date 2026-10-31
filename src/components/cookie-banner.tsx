"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

const COOKIE = "bf_cookie_consent";

// BarberFlow sets only strictly necessary cookies (sign-in session, this
// choice). The banner records acknowledgement; no optional trackers load
// regardless of the answer.
export function CookieBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reading document.cookie must happen after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`)));
  }, []);

  function choose(value: "accepted" | "essential") {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <section
      role="region"
      aria-label={t.cookies.region}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-5 shadow-soft"
    >
      <h2 className="text-base font-semibold text-ink">{t.cookies.title}</h2>
      <p className="mt-1 text-sm text-muted">
        {t.cookies.body}{" "}
        <Link href="/legal/cookies" className="font-medium text-accent underline underline-offset-2">
          {t.cookies.policy}
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => choose("accepted")}>
          {t.cookies.accept}
        </button>
        <button type="button" className="btn-secondary" onClick={() => choose("essential")}>
          {t.cookies.essential}
        </button>
      </div>
    </section>
  );
}
