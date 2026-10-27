"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

// Never render error.message: in production it is redacted, and in general
// it may contain internals. The digest lets support match server logs.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main" className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="card max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.error.title}</h1>
        <p className="mt-3 text-muted">{t.error.body}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">{fmt(t.error.reference, { digest: error.digest })}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            {t.error.retry}
          </button>
          <Link href="/" className="btn-secondary">
            {t.error.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
