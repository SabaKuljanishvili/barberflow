import Link from "next/link";
import { ActionForm, PendingButton } from "@/components/ui/action-form";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { fmt } from "@/i18n/config";
import { updateAppointmentStatus } from "@/app/dashboard/actions";

export type ReviewItem = { id: string; client: string; when: string; whenIso: string; service: string };

/** Overview: past visits still pending/confirmed, with one-click outcome buttons. */
export function ReviewCard({ items, labels: o }: { items: ReviewItem[]; labels: Dictionary["dashboard"]["overview"] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="review" className="card border-warn/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="review" className="text-lg font-semibold">
          {o.review} <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 text-sm text-warn tabular-nums">{items.length}</span>
        </h2>
        <Link href="/dashboard/appointments?range=past" className="text-sm font-medium text-accent">
          {o.reviewMore}
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">{o.reviewNote}</p>
      <ul className="mt-4 divide-y divide-line">
        {items.map((a) => {
          const name = fmt(o.markFor, { client: a.client, when: a.when });
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.client}</p>
                <p className="truncate text-sm text-muted">
                  <time dateTime={a.whenIso}>{a.when}</time> · {a.service}
                </p>
              </div>
              <div className="flex gap-2">
                <ActionForm action={updateAppointmentStatus} resetOnSuccess={false} showMessage={false} aria-label={`${o.markDone}: ${name}`}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="completed" />
                  <PendingButton className="btn-primary py-1.5" pendingLabel="…">
                    {o.markDone}
                  </PendingButton>
                </ActionForm>
                <ActionForm action={updateAppointmentStatus} resetOnSuccess={false} showMessage={false} aria-label={`${o.markNoShow}: ${name}`}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="no_show" />
                  <PendingButton className="btn-secondary py-1.5" pendingLabel="…">
                    {o.markNoShow}
                  </PendingButton>
                </ActionForm>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
