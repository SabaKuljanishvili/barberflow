import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fallback trigger for the retention job where pg_cron is unavailable.
// pg_cron already runs public.archive_old_appointments() nightly.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().rpc("archive_old_appointments");
  if (error) {
    console.error("archive cron failed", error.message);
    return NextResponse.json({ error: "Archive run failed" }, { status: 500 });
  }
  return NextResponse.json({ archived: data });
}
