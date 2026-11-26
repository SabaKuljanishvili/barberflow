import type { CSSProperties, ReactNode } from "react";

/** Spot colours, as `r, g, b` tokens in tokens.css (--spot-*). */
export type SpotColor = "green" | "mint" | "teal";

/** Offset from one edge of the host, in desktop px (scaled with the spot), or "center". */
type Offset = number | "center";

export type AmbientSpotProps = {
  color: SpotColor;
  /** Diameter at ≥ 1024px. Tablet draws it × 0.75, phones × 0.55. */
  size: number;
  /** Alpha at the centre; the gradient fades to 0 at 66% of the radius. */
  opacity: number;
  /** One drift cycle, in seconds. */
  duration: number;
  top?: Offset;
  right?: Offset;
  bottom?: Offset;
  left?: Offset;
  /** Hidden under 768px (phones keep only the first spot of a section). */
  desktopOnly?: boolean;
};

// "center" puts the spot's middle on the host's middle line; px offsets scale
// with the spot (--amb-k), so tablet and phone keep the desktop composition.
const offset = (value: Offset | undefined) => {
  if (value === undefined) return undefined;
  if (value === "center") return "calc(50% - var(--amb-size) * var(--amb-k) / 2)";
  return `calc(${value}px * var(--amb-k))`;
};

/**
 * A large, very soft light spot that drifts slowly behind the content. Only a
 * radial gradient (no blur filter) and a transform-only animation, so it is
 * cheap to composite. Styles: landing.css `.amb`.
 */
export function AmbientSpot({ color, size, opacity, duration, top, right, bottom, left, desktopOnly }: AmbientSpotProps) {
  const style = {
    "--amb-rgb": `var(--spot-${color})`,
    "--amb-a": opacity,
    "--amb-size": `${size}px`,
    "--amb-dur": `${duration}s`,
    top: offset(top),
    right: offset(right),
    bottom: offset(bottom),
    left: offset(left),
  } as CSSProperties;
  return <div className="amb" style={style} data-desktop-only={desktopOnly || undefined} aria-hidden="true" />;
}

/**
 * Full-bleed layer for spots inside a centred `.wrap` section: it spans the
 * viewport width and the host's height, so spot offsets are measured from
 * the screen edges like in the design. The host needs `.amb-host`.
 */
export function AmbientLayer({ children }: { children: ReactNode }) {
  return (
    <div className="amb-layer" aria-hidden="true">
      {children}
    </div>
  );
}
