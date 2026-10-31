/** Drifting blurred blobs and film grain behind the whole marketing page. */
export function BackgroundFX() {
  return (
    <div className="deco" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <svg className="noise">
        <filter id="bfnoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#bfnoise)" />
      </svg>
    </div>
  );
}
