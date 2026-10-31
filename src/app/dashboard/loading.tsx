"use client";

import { useI18n } from "@/i18n/client";

// Every dashboard page is dynamic (it reads the session). Without this file
// Next.js skips prefetching them and a click waits for the whole server
// render; with it, the sidebar link prefetches this skeleton and navigation
// shows it at once while the page streams in.
export default function DashboardLoading() {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-6">
      <span className="sr-only">{t.loading}</span>
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-xl bg-line" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-line/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card h-80 xl:col-span-2" />
        <div className="card h-80" />
      </div>
    </div>
  );
}
