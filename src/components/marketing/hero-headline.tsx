import { Fragment, type CSSProperties } from "react";
import { splitHeadline, type HeadlineText } from "./hero-headline-data";

/**
 * Hero <h1>: every letter is its own span so CSS can cascade them in.
 * Server component; the animation is pure CSS (app/landing.css, `.headline`).
 * Screen readers get the plain sentence from aria-label.
 */
export function HeroHeadline({ text }: { text: HeadlineText }) {
  const { words, end, label } = splitHeadline(text);
  return (
    <h1 className="headline" aria-label={label} style={{ "--end": `${end}ms` } as CSSProperties}>
      <GlossFilter />
      <span aria-hidden="true" className="gloss">
        {words.map((word, w) => (
          <Fragment key={w}>
            {w > 0 && " "}
            {/* Phones put the green phrase on its own line (landing.css, .hl-br). */}
            {w > 0 && word[0]?.j === 0 && <br className="hl-br" />}
            <span className="w">
              {word.map(({ ch, i, j }) => (
                <span
                  key={i}
                  className={j === null ? "c" : "c g"}
                  style={{ "--i": i, ...(j !== null && { "--j": j }) } as CSSProperties}
                >
                  {ch}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}

/** id of the SVG filter that `.headline .gloss` points at (app/landing.css). */
const GLOSS_FILTER_ID = "bf-gloss";

/**
 * Glossy "inflated plastic" look of the brand star, for live text.
 * The blurred letter alpha acts as a height map: diffuse light shades the
 * edges, specular light adds the wet highlight, and a soft drop shadow
 * lifts the letters. Light comes from the top left, like on the logo.
 * Browsers without SVG filters on HTML just show the plain text.
 */
function GlossFilter() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="gloss-defs">
      <filter id={GLOSS_FILTER_ID} x="-5%" y="-15%" width="110%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="height" />
        <feDiffuseLighting in="height" surfaceScale="6" diffuseConstant="1" lightingColor="#ffffff" result="diffuse">
          <feDistantLight azimuth="225" elevation="55" />
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="1.1" k2="0.08" result="shaded" />
        <feComposite in="shaded" in2="SourceAlpha" operator="in" result="body" />
        {/* Low light + tight exponent: flat letter tops stay dark, only the
            rounded edges facing the light catch the shine. */}
        <feSpecularLighting in="height" surfaceScale="6" specularConstant="1.1" specularExponent="45" lightingColor="#ffffff" result="spec">
          <feDistantLight azimuth="225" elevation="30" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="shine" />
        <feComposite in="body" in2="shine" operator="arithmetic" k2="1" k3="0.8" result="lit" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="shadowBlur" />
        <feOffset in="shadowBlur" dy="4" result="shadowOffset" />
        <feFlood floodColor="#000000" floodOpacity="0.22" />
        <feComposite in2="shadowOffset" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="lit" />
        </feMerge>
      </filter>
    </svg>
  );
}
