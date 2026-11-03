import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { en } from "@/i18n/dictionaries/en";
import { BRAND_MARK_SRC, site } from "@/lib/site";

// Crawlers fetch this without a language cookie, and the default OG font has
// no Georgian glyphs, so the card stays in English.

export const alt = `${site.name}: ${en.meta.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), "public", BRAND_MARK_SRC), "base64");
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
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
          <img src={`data:image/png;base64,${mark}`} width={72} height={72} alt="" />
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
