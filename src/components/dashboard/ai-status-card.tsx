import Link from "next/link";
import { Bot } from "lucide-react";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function AiStatusCard({
  enabled,
  phoneNumber,
  callsToday,
  bookedToday,
  canConfigure,
}: {
  enabled: boolean;
  phoneNumber: string | null;
  callsToday: number;
  bookedToday: number;
  canConfigure: boolean;
}) {
  const { t } = await getI18n();
  const a = t.dashboard.agent;
  const live = enabled && !!phoneNumber;
  const rate = callsToday ? Math.round((bookedToday / callsToday) * 100) : 0;
  return (
    <section aria-labelledby="ai-status" className="rounded-3xl bg-brand-900 p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-white/10">
          <Bot aria-hidden className="size-5 text-brand-100" />
        </span>
        <h2 id="ai-status" className="text-sm font-semibold">
          {a.title}
        </h2>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            live ? "bg-brand-500/20 text-brand-100" : "bg-white/10 text-white"
          }`}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${live ? "bg-brand-500" : "bg-white/60"}`} />
          {live ? a.live : a.off}
        </span>
      </div>
      {live ? (
        <>
          <p className="mt-3 text-xs text-brand-100">{fmt(a.answering, { phone: phoneNumber })}</p>
          <p className="mt-3 text-sm">
            <strong className="text-2xl font-bold">{callsToday}</strong> {fmt(a.callsToday, { booked: bookedToday })}
          </p>
          <div
            className="mt-2 h-2 rounded-full bg-white/10"
            role="progressbar"
            aria-label={a.progress}
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${rate}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-brand-100">
          {phoneNumber ? a.turnedOff : a.noNumber}{" "}
          {canConfigure && (
            <Link href="/dashboard/settings" className="font-medium text-white underline underline-offset-2">
              {a.setUp}
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
