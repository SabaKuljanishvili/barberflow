import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { RATE_LIMIT_RULES, rateLimit } from "@/lib/rate-limit";

const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (progress bars) need 'unsafe-inline'; scripts stay nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}`.trim(),
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit APIs on every method, auth pages only on form posts.
  const rule = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.prefix));
  if (rule && (pathname.startsWith("/api") || request.method === "POST")) {
    const result = rateLimit(`${clientKey(request)}:${rule.prefix}`, rule.limit, rule.windowMs);
    if (!result.ok) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) },
      });
    }
  }

  // Webhooks and cron authenticate themselves (Twilio signature / bearer secret).
  if (pathname.startsWith("/api")) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const needsAuth = pathname.startsWith("/dashboard");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (url && key && (needsAuth || isAuthPage)) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    });
    // Refreshes the session cookie. Authorization is still enforced in each
    // page (requireUser/requireManager) and by RLS; this is only a fast path.
    // getClaims() verifies the JWT locally with asymmetric signing keys, so
    // most requests skip the round trip to the Auth server.
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims.sub;

    if (needsAuth && !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    if (isAuthPage && user) return NextResponse.redirect(new URL("/dashboard", request.url));
  } else if (needsAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|llms.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
