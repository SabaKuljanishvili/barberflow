import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// redirect() throws in Next.js; mirror that so control flow stops.
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

let claims: { sub: string } | null = null;
let profileRow: Record<string, unknown> | null = null;
let profileError: { code: string; message: string } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profileRow, error: profileError }) }),
      }),
    }),
  }),
}));

const { getSession, requireUser, requireManager } = await import("./auth");

const salon = { id: "salon-1", name: "Salon", timezone: "Asia/Tbilisi" };
function managerRow(extra: Record<string, unknown> = {}) {
  return { id: "user-1", salon_id: "salon-1", role: "manager", full_name: "M", email: "m@example.com", active: true, takes_clients: true, salons: salon, ...extra };
}

beforeEach(() => {
  redirect.mockClear();
  claims = { sub: "user-1" };
  profileRow = managerRow();
  profileError = null;
});

describe("login access", () => {
  it("an existing active manager can sign in and open /dashboard", async () => {
    const session = await requireUser();
    expect(redirect).not.toHaveBeenCalled();
    expect(session.isManager).toBe(true);
    expect(session.salon.id).toBe("salon-1");
    // Manager-only pages open too.
    await expect(requireManager()).resolves.toMatchObject({ isManager: true });
  });

  it("an active barber gets in but not onto manager pages", async () => {
    profileRow = managerRow({ role: "barber" });
    await expect(requireUser()).resolves.toMatchObject({ isManager: false });
    await expect(requireManager()).rejects.toThrow("REDIRECT:/dashboard?error=forbidden");
  });

  it("a deactivated member loses access", async () => {
    profileRow = managerRow({ active: false });
    expect(await getSession()).toBeNull();
    await expect(requireUser()).rejects.toThrow("REDIRECT:/auth/ended");
  });

  it("no login means no session", async () => {
    claims = null;
    expect(await getSession()).toBeNull();
  });

  it("a profile without the active column (migrations not applied) is denied and logged", async () => {
    const stale: Record<string, unknown> = managerRow();
    delete stale.active;
    delete stale.takes_clients;
    profileRow = stale;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getSession()).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("migrations"));
    log.mockRestore();
  });

  it("a failed profile query is denied and logged", async () => {
    profileRow = null;
    profileError = { code: "42703", message: "column does not exist" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getSession()).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
