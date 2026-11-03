"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

// Renders inside the dashboard layout, so the sidebar and top bar stay usable
// when one page fails. Never show error.message (redacted in production).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold tracking-tight">{t.error.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.error.pageBody}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">{fmt(t.error.reference, { digest: error.digest })}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          {t.error.retry}
        </button>
        <Link href="/dashboard" className="btn-secondary">
          {t.error.dashboard}
        </Link>
      </div>
    </div>
  );
}
