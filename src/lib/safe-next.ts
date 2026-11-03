/**
 * Post-login redirect target from `?next=`. Only same-origin relative paths:
 * one leading "/", no "//" or backslash (browsers treat "/\host" as
 * protocol-relative), no control characters, no encoded slashes that a later
 * decode could turn into "//". Anything else becomes the fallback.
 */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001F\u007F]/.test(value) || /%2f|%5c/i.test(value)) return fallback;
  try {
    const base = "http://local.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return value;
}

/** Where each email link lands once its session exists. */
export function destinationFor(type: string | null, next: string | null): string {
  if (type === "invite") return "/reset-password?invite=1";
  if (type === "recovery") return "/reset-password";
  if (type === "email_change") return "/dashboard/account?emailChanged=1";
  return safeNext(next);
}
