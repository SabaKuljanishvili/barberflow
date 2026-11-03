import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fallback trigger for the retention job where pg_cron is unavailable.
// pg_cron already runs public.complete_past_appointments() and
// public.archive_old_appointments() nightly.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  // Complete past visits first so they are archived as completed, with a price.
  const completed = await admin.rpc("complete_past_appointments");
  if (completed.error) console.error("auto-complete failed", completed.error.message);
  const { data, error } = await admin.rpc("archive_old_appointments");
  if (error) {
    console.error("archive cron failed", error.message);
    return NextResponse.json({ error: "Archive run failed" }, { status: 500 });
  }
  return NextResponse.json({ completed: completed.data ?? 0, archived: data });
}
