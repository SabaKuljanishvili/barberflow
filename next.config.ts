import type { NextConfig } from "next";

// CSP is set per request in src/proxy.ts (it needs a nonce).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  experimental: {
    // Tree-shake icon imports so only used icons ship.
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "100kb",
      allowedOrigins: process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).host] : [],
    },
  },
  serverExternalPackages: ["twilio"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // APIs are server-to-server (Twilio, cron). No CORS headers are ever
        // sent, so browsers block cross-origin reads by default. TTS audio is
        // excluded: it sets its own immutable caching.
        source: "/api/:path((?!voice/tts).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
