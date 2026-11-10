"use client";

import Link from "next/link";
import { fmt } from "@/i18n/config";
import { groupByDate } from "@/lib/appointments-ui";
import { canReschedule } from "@/lib/booking-rules";
import { useBoard } from "./board";
import { RowMenu, StatusMenu } from "./menus";
import { colorVar, type ApptVM } from "./types";

// Spec columns at ≥1280px. Between 1024 and 1279 (sidebar open, ~660px) the source moves under the service, so nothing scrolls sideways.
const COLS = "lg:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_170px_40px] lg:gap-3 xl:grid-cols-[90px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_150px_170px_40px] xl:gap-4";

/** List view: rows grouped by day, one status pill per row, a ⋯ menu, "Load more" after 50. */
export function ListView({ rows, todayIso, dateTitles, moreHref }: { rows: ApptVM[]; todayIso: string; dateTitles: Record<string, string>; moreHref: string | null }) {
  const { labels: p, names, openDetails, statusOf, changeStatus, isHighlighted } = useBoard();
  const groups = groupByDate(rows);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain lg:pr-1">
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ap-line bg-ap-bg p-6 text-sm text-ap-muted">{p.none}</p>
      ) : (
        <>
          <div aria-hidden className={`sticky top-0 z-10 hidden bg-ap-card px-4 pb-1 text-xs font-semibold text-ap-faint lg:grid ${COLS}`}>
            <span>{p.colTime}</span>
            <span>{p.colClient}</span>
            <span>{p.colService}</span>
            <span>{p.colBarber}</span>
            <span className="hidden xl:block">{p.colSource}</span>
            <span>{p.colStatus}</span>
            <span />
          </div>
          {groups.map((g) => (
            <section key={g.date} aria-label={dateTitles[g.date]} className="flex flex-col gap-1.5">
              <h3 className={`px-1 text-[13px] font-bold ${g.date === todayIso ? "text-accent" : "text-ap-ink2"}`}>{dateTitles[g.date]}</h3>
              <ul className="flex flex-col gap-1.5">
                {g.rows.map((a) => {
                  const s = statusOf(a);
                  const status = <StatusMenu status={s} onChange={(next) => changeStatus(a, next)} canEdit={a.canEdit} who={a.client} labels={p} names={names} />;
                  const menu = (
                    <RowMenu
                      who={a.client}
                      clientHref={`/dashboard/clients/${a.clientId}`}
                      canEdit={a.canEdit}
                      canReschedule={canReschedule(s)}
                      canCancel={s !== "cancelled"}
                      onReschedule={() => openDetails(a)}
                      onCancel={() => changeStatus(a, "cancelled")}
                      labels={p}
                    />
                  );
                  const source = a.source === "voice" ? p.sourceVoice : p.sourceDashboard;
                  const barber = (
                    <span className="flex min-w-0 items-center gap-2 text-[13px]">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: colorVar(a.color) }} />
                      <span className="truncate">{a.barber}</span>
                    </span>
                  );
                  return (
                    <li key={a.id} className={`rounded-[14px] border border-ap-line bg-ap-row px-4 py-3 ${isHighlighted(a) ? "ap-flash" : ""}`}>
                      {/* ≥1024px: one grid row. */}
                      <div className={`hidden items-center lg:grid ${COLS}`}>
                        <span className="flex flex-col">
                          <b className="text-[17px] tabular-nums">{a.time}</b>
                          <span className="text-[11px] whitespace-nowrap text-ap-faint">{fmt(p.minutes, { n: a.duration })}</span>
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <button type="button" onClick={() => openDetails(a)} className="truncate text-left text-sm font-bold hover:text-accent">
                            {a.client}
                          </button>
                          <span className="truncate text-xs text-ap-muted tabular-nums">{a.phone}</span>
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{a.service}</span>
                          <span className="truncate text-xs text-ap-muted xl:hidden">{source}</span>
                        </span>
                        {barber}
                        <span className="hidden truncate text-[13px] text-ap-muted xl:block">{source}</span>
                        <span className="justify-self-start">{status}</span>
                        {menu}
                      </div>
                      {/* Under 1024px: a stacked card. */}
                      <div className="flex flex-col gap-1.5 lg:hidden">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-baseline gap-2">
                            <b className="text-[17px] tabular-nums">{a.time}</b>
                            <span className="text-[11px] whitespace-nowrap text-ap-faint">{fmt(p.minutes, { n: a.duration })}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {status}
                            {menu}
                          </span>
                        </div>
                        <button type="button" onClick={() => openDetails(a)} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left">
                          <b className="truncate text-sm">{a.client}</b>
                          <span className="text-xs text-ap-muted tabular-nums">{a.phone}</span>
                        </button>
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ap-ink2">
                          <span className="truncate">{a.service}</span>·{barber}
                        </span>
                        <span className="text-xs text-ap-muted">{source}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {moreHref && (
            <Link href={moreHref} scroll={false} className="mx-auto mt-1 flex h-10 items-center rounded-xl border border-ap-chip-line px-5 text-sm font-semibold text-ap-ink2 hover:border-ap-sel-line">
              {p.loadMore}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
