import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { salonSettingsSchema, salonSettingsUpdate } from "./validation";

// `authenticated` may only UPDATE the salons columns granted to it by column.
// A column the settings form writes but that has no grant makes Postgres
// reject the whole update with 42501, which the UI shows as "forbidden".
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function grantedSalonColumns(): Set<string> {
  const granted = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(/--.*$/gm, "");
    const statements = /(revoke\s+update\s+on\s+public\.salons\s+from\s+authenticated)|grant\s+update\s*\(([^)]*)\)\s*on\s+public\.salons\s+to\s+authenticated/gi;
    for (const match of sql.matchAll(statements)) {
      if (match[1]) granted.clear();
      else for (const col of match[2].split(",")) granted.add(col.trim());
    }
  }
  return granted;
}

describe("salons column grants", () => {
  it("cover every column the settings form updates", () => {
    const parsed = salonSettingsSchema.parse({
      name: "Salon",
      phoneNumber: "+995555123456",
      timezone: "Asia/Tbilisi",
      opensAt: "09:00",
      closesAt: "19:00",
      workingDays: ["1", "2"],
      voiceAgentEnabled: "on",
      locale: "ka",
    });
    const granted = grantedSalonColumns();
    const missing = Object.keys(salonSettingsUpdate(parsed)).filter((c) => !granted.has(c));
    expect(missing).toEqual([]);
  });
});
