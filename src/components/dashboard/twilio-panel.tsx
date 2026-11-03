import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { CopyField } from "@/components/ui/copy-field";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { connectionStatus, webhookUrls } from "@/lib/voice/twilio-numbers";

type Labels = Dictionary["dashboard"]["settings"];

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className={`flex items-start gap-2 ${ok ? "text-accent" : "text-danger"}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

/** Settings → Voice agent: live check of the Twilio number and its webhooks. Never throws. */
export async function TwilioPanel({ phone, labels: p }: { phone: string | null; labels: Labels }) {
  const status = await connectionStatus(phone);
  const urls = webhookUrls();
  const notice =
    status.kind === "no-number" ? p.connNoNumber : status.kind === "not-configured" ? p.connNotConfigured : status.kind === "error" ? p.connError : status.kind === "missing" ? p.connMissing : null;

  return (
    <div className="space-y-3 rounded-2xl bg-canvas p-4 text-sm">
      <p className="font-medium text-ink">{p.twilioSetup}</p>
      {status.kind === "checked" ? (
        <ul className="space-y-1">
          <Row ok>{p.connFound}</Row>
          <Row ok={status.voice}>{`${p.hookVoice}: ${status.voice ? p.hookOk : p.hookWrong}`}</Row>
          <Row ok={status.status}>{`${p.hookStatus}: ${status.status ? p.hookOk : p.hookWrong}`}</Row>
          <Row ok={status.sms}>{`${p.hookSms}: ${status.sms ? p.hookOk : p.hookWrong}`}</Row>
        </ul>
      ) : (
        <p className={`flex items-start gap-2 ${status.kind === "missing" ? "text-danger" : "text-muted"}`}>
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </p>
      )}
      <p className="text-muted">{p.twilioHelp}</p>
      <CopyField label={p.hookVoice} value={urls.voice} copyLabel={p.copy} copiedLabel={p.copied} />
      <CopyField label={p.hookStatus} value={urls.status} copyLabel={p.copy} copiedLabel={p.copied} />
      <CopyField label={p.hookSms} value={urls.sms} copyLabel={p.copy} copiedLabel={p.copied} />
      {status.kind !== "no-number" && status.kind !== "not-configured" && <RefreshButton label={p.checkAgain} />}
    </div>
  );
}
