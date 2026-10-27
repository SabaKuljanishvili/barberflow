// Fixed-window limiter keyed by client + bucket. In-memory, so limits are per
// server instance; on multi-instance deployments swap the store for Redis
// (e.g. Upstash) behind the same function signature.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    if (store.size >= MAX_KEYS) prune(now);
    const fresh = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

function prune(now: number) {
  for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  // Still full of live keys: drop the oldest insertions rather than grow unbounded.
  if (store.size >= MAX_KEYS) {
    let n = Math.ceil(MAX_KEYS / 10);
    for (const k of store.keys()) {
      store.delete(k);
      if (--n === 0) break;
    }
  }
}

export function resetRateLimits() {
  store.clear();
}

/** Limits applied by proxy.ts, matched by path prefix (first match wins). */
export const RATE_LIMIT_RULES: { prefix: string; limit: number; windowMs: number }[] = [
  { prefix: "/login", limit: 10, windowMs: 60_000 },
  { prefix: "/signup", limit: 5, windowMs: 60_000 },
  { prefix: "/auth", limit: 10, windowMs: 60_000 },
  // Twilio fetches every spoken sentence from its own egress IPs, so audio
  // needs headroom; URLs are HMAC-signed, so this is not the main defence.
  { prefix: "/api/voice/tts", limit: 1200, windowMs: 60_000 },
  { prefix: "/api/voice", limit: 120, windowMs: 60_000 },
  { prefix: "/api/sms", limit: 60, windowMs: 60_000 },
  { prefix: "/api/cron", limit: 10, windowMs: 60_000 },
  { prefix: "/api", limit: 60, windowMs: 60_000 },
];
