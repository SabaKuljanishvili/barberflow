import { ImageResponse } from "next/og";
import { en } from "@/i18n/dictionaries/en";
import { site } from "@/lib/site";

// Crawlers fetch this without a language cookie, and the default OG font has
// no Georgian glyphs, so the card stays in English.

export const alt = `${site.name}: ${en.meta.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "#064E3B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 28, height: 40, borderLeft: "8px solid #10B981", borderRight: "8px solid #10B981" }} />
          </div>
          <span style={{ fontSize: 44, fontWeight: 700, color: "#111827" }}>{site.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: "#064E3B", lineHeight: 1.05 }}>{en.meta.tagline}</span>
          <span style={{ fontSize: 30, color: "#6B7280", maxWidth: 900 }}>
            {en.meta.ogSubtitle}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
