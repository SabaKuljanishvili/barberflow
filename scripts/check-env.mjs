#!/usr/bin/env node
// Fails fast when required environment variables are missing or malformed.
// Run with: npm run check-env   (loads .env.local if present)
import { existsSync, readFileSync } from "node:fs";

const file = ".env.local";
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const rules = {
  NEXT_PUBLIC_SITE_URL: (v) => /^https?:\/\//.test(v),
  NEXT_PUBLIC_SUPABASE_URL: (v) => /^https:\/\/.+/.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(v),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: (v) => v.length >= 20,
  SUPABASE_SERVICE_ROLE_KEY: (v) => v.length >= 20,
  CRON_SECRET: (v) => v.length >= 32,
};

// Twilio is optional (phone calls + SMS). Set all three or none.
const twilioRules = {
  TWILIO_ACCOUNT_SID: (v) => /^AC[0-9a-f]{32}$/i.test(v),
  TWILIO_AUTH_TOKEN: (v) => v.length >= 16,
  TWILIO_WEBHOOK_BASE_URL: (v) => /^https?:\/\//.test(v),
};

const failures = Object.entries(rules)
  .filter(([key, ok]) => !process.env[key] || !ok(process.env[key]))
  .map(([key]) => key);

if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://")) {
  failures.push("NEXT_PUBLIC_SITE_URL (must be https in production)");
}

try {
  const u = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (u.pathname !== "/" || u.search || u.hash) {
    console.warn(`Warning: NEXT_PUBLIC_SITE_URL should be the bare origin (${u.origin}); the path "${u.pathname}" is ignored.`);
  }
} catch {
  // Reported by the rule above.
}

if (!Object.keys(twilioRules).some((key) => process.env[key])) {
  console.warn("Warning: Twilio not set. Phone calls and SMS are off; the web voice agent (/dashboard/voice) still works.");
} else {
  for (const [key, ok] of Object.entries(twilioRules)) if (!process.env[key] || !ok(process.env[key])) failures.push(key);
}

// Optional, but Georgian speech needs it: warn instead of failing.
if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
  console.warn(
    "Warning: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set. Phone calls are answered in English only; the web voice agent has no voice and uses typing or the browser's speech recognition.",
  );
}
if (!process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
  console.warn("Warning: neither ANTHROPIC_API_KEY nor GROQ_API_KEY set. The voice agents will only understand menu numbers and keywords.");
}

if (failures.length) {
  console.error(`Missing or invalid env vars:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("Environment OK");
