import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { fetchAllPages } from "@/lib/paginate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Salon data export for managers: /dashboard/export?type=clients|appointments.
// Runs as the signed-in user, so RLS scopes every row to their salon.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!session.isManager) return new NextResponse("Forbidden", { status: 403 });
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createSupabaseServerClient();
  const stamp = new Date().toISOString().slice(0, 10);

  let csv: string;
  if (type === "clients") {
    let data;
    try {
      data = await fetchAllPages((from, to) =>
        supabase.from("clients").select("first_name, last_name, phone_number, locale, notes, created_at").order("created_at").order("id").range(from, to),
      );
    } catch {
      return new NextResponse("Export failed", { status: 500 });
    }
    csv = toCsv(
      ["first_name", "last_name", "phone", "language", "notes", "created_at"],
      (data ?? []).map((c) => [c.first_name, c.last_name, c.phone_number, c.locale, c.notes, c.created_at]),
    );
  } else if (type === "appointments") {
    let data;
    try {
      data = await fetchAllPages((from, to) =>
        supabase
          .from("appointments")
          .select("appointment_time, ends_at, status, source, clients(first_name, last_name, phone_number), services(name, price), profiles(full_name)")
          .order("appointment_time")
          .order("id")
          .range(from, to),
      );
    } catch {
      return new NextResponse("Export failed", { status: 500 });
    }
    csv = toCsv(
      ["start", "end", "status", "source", "client", "client_phone", "service", "price", "barber"],
      (data ?? []).map((a) => [
        a.appointment_time,
        a.ends_at,
        a.status,
        a.source,
        `${a.clients?.first_name ?? ""} ${a.clients?.last_name ?? ""}`.trim(),
        a.clients?.phone_number,
        a.services?.name,
        a.services?.price,
        a.profiles?.full_name,
      ]),
    );
  } else {
    return new NextResponse("Unknown export type", { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="devskstudio-${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
