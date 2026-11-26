/**
 * Seeds a separate QA salon with a manager and a barber login for manual testing.
 *
 *   npm run seed:test            create what is missing (safe to re-run)
 *   npm run seed:test -- --reset delete the QA salon and its two users, then recreate them
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Passwords are generated here, printed once, and stored only in
 * .env.test-accounts.local (git-ignored). Nothing outside the QA salon and the
 * two QA logins is ever read for writing or deleted.
 */
import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const QA = {
  salonName: "Test Salon (QA)",
  manager: { email: "qa-manager@devskstudio.test", fullName: "QA Manager", role: "manager" },
  barber: { email: "qa-barber@devskstudio.test", fullName: "QA Barber", role: "barber" },
} as const;
const SECRETS_FILE = ".env.test-accounts.local";
const TIMEZONE = "Asia/Tbilisi"; // UTC+4 all year (no DST)
const TZ_OFFSET_HOURS = 4;

type Account = typeof QA.manager | typeof QA.barber;

function fail(message: string): never {
  console.error(`\nseed:test refused: ${message}`);
  process.exit(1);
}

// Safety guard: this script may only ever touch the QA salon and QA logins.
function assertQaValues() {
  if (QA.salonName !== "Test Salon (QA)") fail(`salon name must be "Test Salon (QA)", got "${QA.salonName}"`);
  for (const a of [QA.manager, QA.barber]) {
    if (!/^qa-[a-z]+@devskstudio\.test$/.test(a.email)) fail(`"${a.email}" is not a QA address (qa-*@devskstudio.test)`);
  }
  if (QA.manager.email !== "qa-manager@devskstudio.test" || QA.barber.email !== "qa-barber@devskstudio.test") {
    fail("QA emails were changed; expected qa-manager@ and qa-barber@devskstudio.test");
  }
}
const QA_EMAILS = new Set<string>([QA.manager.email, QA.barber.email]);

function loadEnv() {
  if (!existsSync(".env.local")) fail(".env.local not found; run from the barberflow folder");
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return { url, key, loginUrl: `${site}/login` };
}

function strongPassword(length = 24): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!#%*+-=?@^_"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function readSecrets(): Record<string, string> {
  if (!existsSync(SECRETS_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(SECRETS_FILE, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

function passwordKey(a: Account) {
  return a.role === "manager" ? "QA_MANAGER_PASSWORD" : "QA_BARBER_PASSWORD";
}

async function findUser(db: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

async function findQaSalon(db: SupabaseClient): Promise<{ id: string; name: string } | null> {
  const { data, error } = await db.from("salons").select("id, name").eq("name", QA.salonName);
  if (error) fail(`could not read salons: ${error.message}`);
  if (data.length > 1) fail(`found ${data.length} salons named "${QA.salonName}"; clean them up by hand first`);
  return data[0] ?? null;
}

// The seeded data uses columns from migrations 20261103000200-000900.
async function assertSchema(db: SupabaseClient) {
  const checks: [string, string][] = [
    ["profiles", "active, takes_clients"],
    ["services", "sort_order, active"],
    ["salons", "closed_dates, auto_complete_appointments"],
    ["clients", "notes"],
  ];
  for (const [table, cols] of checks) {
    const { error } = await db.from(table).select(cols).limit(1);
    if (error) fail(`${table}(${cols}) is missing on this project. Apply supabase/migrations 20261103* first.`);
  }
}

async function reset(db: SupabaseClient) {
  const salon = await findQaSalon(db);
  if (salon) {
    if (salon.name !== QA.salonName) fail("salon name mismatch during reset");
    const { data: staff, error } = await db.from("profiles").select("id, email").eq("salon_id", salon.id);
    if (error) fail(`could not read QA staff: ${error.message}`);
    const foreign = staff.filter((s) => !QA_EMAILS.has(s.email.toLowerCase()));
    if (foreign.length) fail(`QA salon has ${foreign.length} non-QA member(s); remove them in the dashboard first`);
    // Appointments first: services are ON DELETE RESTRICT from appointments.
    for (const table of ["appointments", "appointments_archive"]) {
      const { error: e } = await db.from(table).delete().eq("salon_id", salon.id);
      if (e) fail(`could not clear ${table}: ${e.message}`);
    }
    const { error: e } = await db.from("salons").delete().eq("id", salon.id).eq("name", QA.salonName);
    if (e) fail(`could not delete QA salon: ${e.message}`);
  }
  for (const a of [QA.manager, QA.barber]) {
    const user = await findUser(db, a.email);
    if (!user) continue;
    if (user.email?.toLowerCase() !== a.email) fail("user email mismatch during reset");
    const { data: other } = await db.from("profiles").select("salon_id").eq("id", user.id).maybeSingle();
    if (other) fail(`${a.email} still belongs to another salon; not deleting it`);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) fail(`could not delete ${a.email}: ${error.message}`);
  }
  console.log("Reset: QA salon and QA users removed.");
}

async function ensureSalon(db: SupabaseClient): Promise<string> {
  const hours = { timezone: TIMEZONE, opens_at: "09:00", closes_at: "19:00", working_days: [1, 2, 3, 4, 5, 6], closed_dates: [] };
  const existing = await findQaSalon(db);
  if (existing) {
    const { error } = await db.from("salons").update(hours).eq("id", existing.id).eq("name", QA.salonName);
    if (error) fail(`could not update QA salon hours: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await db.from("salons").insert({ name: QA.salonName, locale: "ka", ...hours }).select("id").single();
  if (error) fail(`could not create QA salon: ${error.message}`);
  console.log(`Created salon "${QA.salonName}".`);
  return data.id;
}

/** Returns the user id and, only when a password was set in this run, that password. */
async function ensureUser(db: SupabaseClient, salonId: string, a: Account, saved: Record<string, string>) {
  let user = await findUser(db, a.email);
  let password: string | null = null;

  if (user) {
    const { data: profile } = await db.from("profiles").select("salon_id").eq("id", user.id).maybeSingle();
    if (profile && profile.salon_id !== salonId) fail(`${a.email} belongs to a different salon; refusing to move it`);
    if (!saved[passwordKey(a)]) {
      // Password file was lost: issue a new one rather than leave the login unusable.
      password = strongPassword();
      const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (error) fail(`could not set password for ${a.email}: ${error.message}`);
    }
  } else {
    password = strongPassword();
    // No salon_name in metadata, so the signup trigger does not create a salon.
    const { data, error } = await db.auth.admin.createUser({
      email: a.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: a.fullName },
    });
    if (error) fail(`could not create ${a.email}: ${error.message}`);
    user = data.user;
    console.log(`Created login ${a.email}.`);
  }

  const { error } = await db.from("profiles").upsert(
    { id: user.id, salon_id: salonId, full_name: a.fullName, role: a.role, email: a.email, active: true, takes_clients: true },
    { onConflict: "id" },
  );
  if (error) fail(`could not write profile for ${a.email}: ${error.message}`);
  return { id: user.id, password };
}

async function ensureServices(db: SupabaseClient, salonId: string) {
  const wanted = [
    { name: "Haircut", price: 30, duration_minutes: 30, sort_order: 0 },
    { name: "Beard trim", price: 20, duration_minutes: 20, sort_order: 1 },
    { name: "Haircut + beard", price: 45, duration_minutes: 50, sort_order: 2 },
  ];
  const { data: existing, error } = await db.from("services").select("id, name").eq("salon_id", salonId);
  if (error) fail(`could not read services: ${error.message}`);
  const missing = wanted.filter((w) => !existing.some((e) => e.name === w.name));
  if (missing.length) {
    const { error: e } = await db.from("services").insert(missing.map((m) => ({ ...m, salon_id: salonId, active: true })));
    if (e) fail(`could not create services: ${e.message}`);
  }
  const { data } = await db.from("services").select("id, name").eq("salon_id", salonId);
  return Object.fromEntries((data ?? []).map((s) => [s.name, s.id as string]));
}

async function ensureClients(db: SupabaseClient, salonId: string) {
  // Reserved-looking test numbers; upcoming visits are marked reminded so no SMS goes out.
  const rows = [
    { salon_id: salonId, first_name: "Giorgi", last_name: "Test", phone_number: "+995500000101", locale: "ka" },
    { salon_id: salonId, first_name: "Nino", last_name: "Test", phone_number: "+995500000102", locale: "en" },
  ];
  const { data, error } = await db.from("clients").upsert(rows, { onConflict: "salon_id,phone_number" }).select("id, phone_number");
  if (error) fail(`could not write clients: ${error.message}`);
  return data.map((c) => c.id as string);
}

/** A Tbilisi wall-clock time `days` from today, moved off Sundays (salon closed). */
function salonTime(days: number, hour: number): Date {
  const now = new Date(Date.now() + TZ_OFFSET_HOURS * 3_600_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hour - TZ_OFFSET_HOURS));
  const weekday = new Date(d.getTime() + TZ_OFFSET_HOURS * 3_600_000).getUTCDay(); // 0 = Sunday
  if (weekday === 0) d.setUTCDate(d.getUTCDate() + (days < 0 ? -1 : 1));
  return d;
}

async function ensureAppointments(db: SupabaseClient, salonId: string, staff: { manager: string; barber: string }, services: Record<string, string>, clients: string[]) {
  const { count, error } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("salon_id", salonId);
  if (error) fail(`could not read appointments: ${error.message}`);
  if ((count ?? 0) > 0) return 0; // already seeded; --reset refreshes the dates

  const plan = [
    { days: -3, hour: 11, staff: staff.barber, service: "Haircut", client: 0, status: "no_show" },
    { days: -2, hour: 10, staff: staff.manager, service: "Haircut + beard", client: 1, status: "completed" },
    { days: -1, hour: 15, staff: staff.barber, service: "Beard trim", client: 0, status: "completed" },
    { days: 1, hour: 10, staff: staff.barber, service: "Haircut", client: 1, status: "confirmed" },
    { days: 1, hour: 13, staff: staff.manager, service: "Beard trim", client: 0, status: "pending" },
    { days: 2, hour: 16, staff: staff.barber, service: "Haircut + beard", client: 1, status: "pending" },
  ];
  const now = new Date().toISOString();
  const rows = plan.map((p) => ({
    salon_id: salonId,
    staff_id: p.staff,
    service_id: services[p.service],
    client_id: clients[p.client],
    appointment_time: salonTime(p.days, p.hour).toISOString(),
    status: p.status,
    source: "dashboard",
    reminder_sent_at: now, // keeps the reminder cron from texting the fake numbers
  }));
  const { error: e } = await db.from("appointments").insert(rows);
  if (e) fail(`could not create appointments: ${e.message}`);
  return rows.length;
}

function writeSecrets(loginUrl: string, saved: Record<string, string>, fresh: Record<string, string>) {
  const merged = { ...saved, ...fresh };
  const body = [
    "# QA test logins created by scripts/seed-test-accounts.ts. Never commit this file.",
    `QA_LOGIN_URL=${loginUrl}`,
    `QA_MANAGER_EMAIL=${QA.manager.email}`,
    `QA_MANAGER_PASSWORD=${merged.QA_MANAGER_PASSWORD ?? ""}`,
    `QA_BARBER_EMAIL=${QA.barber.email}`,
    `QA_BARBER_PASSWORD=${merged.QA_BARBER_PASSWORD ?? ""}`,
    "",
  ].join("\n");
  writeFileSync(SECRETS_FILE, body, { mode: 0o600 });
}

async function main() {
  assertQaValues();
  const doReset = process.argv.includes("--reset");
  const env = loadEnv();
  const db = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });

  await assertSchema(db);
  if (doReset) await reset(db);

  const saved = doReset ? {} : readSecrets();
  const salonId = await ensureSalon(db);
  const manager = await ensureUser(db, salonId, QA.manager, saved);
  const barber = await ensureUser(db, salonId, QA.barber, saved);
  const services = await ensureServices(db, salonId);
  const clients = await ensureClients(db, salonId);
  const created = await ensureAppointments(db, salonId, { manager: manager.id, barber: barber.id }, services, clients);

  const fresh: Record<string, string> = {};
  if (manager.password) fresh.QA_MANAGER_PASSWORD = manager.password;
  if (barber.password) fresh.QA_BARBER_PASSWORD = barber.password;
  writeSecrets(env.loginUrl, saved, fresh);

  console.log(`\nQA salon ready: ${Object.keys(services).length} services, ${clients.length} clients, ${created} new appointments.`);
  console.log(`Login URL: ${env.loginUrl}`);
  console.log(`Manager:   ${QA.manager.email}`);
  console.log(`Barber:    ${QA.barber.email}`);
  if (Object.keys(fresh).length) {
    console.log("\nNew passwords (shown once; also saved to " + SECRETS_FILE + "):");
    if (manager.password) console.log(`  manager: ${manager.password}`);
    if (barber.password) console.log(`  barber:  ${barber.password}`);
  } else {
    console.log(`Passwords unchanged; see ${SECRETS_FILE}.`);
  }
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
