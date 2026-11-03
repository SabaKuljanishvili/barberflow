import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { WebVoiceAgent } from "@/components/dashboard/web-voice-agent";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { azureConfig } from "@/lib/voice/tts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.voiceAgent.title };
}

export default async function VoiceAgentPage() {
  await requireUser();
  const { t } = await getI18n();
  const p = t.dashboard.voiceAgent;
  return (
    <div className="space-y-6">
      <Breadcrumbs structured={false} items={[{ href: "/dashboard", label: t.dashboard.nav.overview }, { href: "/dashboard/voice", label: p.title }]} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{p.intro}</p>
      </div>
      <WebVoiceAgent labels={p} azure={azureConfig() !== null} appointmentsHref="/dashboard/appointments" />
    </div>
  );
}
