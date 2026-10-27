import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { AiStatusCard } from "@/components/dashboard/ai-status-card";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { TopHeader } from "@/components/dashboard/top-header";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientName } from "@/lib/format";
import { zonedDayBounds } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.dashboard.title, template: t.dashboard.titleTemplate },
    robots: { index: false, follow: false },
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, salon, isManager } = await requireUser();
  const { t } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const { start, end } = zonedDayBounds(new Date(), salon.timezone);

  const [calls, booked, pending] = await Promise.all([
    supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("outcome", "booked")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
    supabase
      .from("appointments")
      .select("id, appointment_time, clients(first_name, last_name, phone_number)")
      .eq("status", "pending")
      .gte("appointment_time", new Date().toISOString())
      .order("appointment_time")
      .limit(5),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:w-64 lg:shrink-0">
        <div className="flex flex-1 flex-col gap-6 rounded-3xl border border-line bg-surface p-4 shadow-soft">
          <div className="px-2 pt-1">
            <Logo href="/dashboard" />
            <p className="mt-2 truncate text-xs text-muted">{salon.name}</p>
          </div>
          <SidebarNav isManager={isManager} labels={t.dashboard.nav} />
          <div className="mt-auto hidden lg:block">
            <AiStatusCard
              enabled={salon.voice_agent_enabled}
              phoneNumber={salon.phone_number}
              callsToday={calls.count ?? 0}
              bookedToday={booked.count ?? 0}
              canConfigure={isManager}
            />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <TopHeader
          fullName={profile.full_name}
          email={profile.email}
          role={profile.role}
          timezone={salon.timezone}
          pending={(pending.data ?? []).map((p) => ({
            id: p.id,
            appointment_time: p.appointment_time,
            client: clientName(p.clients, t.dashboard.unknownClient),
          }))}
        />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
