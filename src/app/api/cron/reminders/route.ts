import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sendDueReminders());
  } catch (err) {
    console.error("reminder cron failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
