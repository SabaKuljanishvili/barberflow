import { CheckCircle2, CircleDashed, CircleSlash, Flag } from "lucide-react";
import { getI18n } from "@/i18n/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";

// Icon + text label: status never relies on colour alone.
const styles: Record<AppointmentStatus, { className: string; icon: typeof CheckCircle2 }> = {
  pending: { className: "bg-amber-50 text-amber-800", icon: CircleDashed },
  confirmed: { className: "bg-brand-50 text-brand-900", icon: CheckCircle2 },
  completed: { className: "bg-slate-100 text-slate-700", icon: Flag },
  cancelled: { className: "bg-red-50 text-red-800", icon: CircleSlash },
};

export async function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = await getI18n();
  const { className, icon: Icon } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      <Icon aria-hidden className="size-3.5" />
      {t.status[status]}
    </span>
  );
}
