// Labels live in the dictionaries (src/i18n); entries here carry the key.
export const site = {
  name: "DevskStudio",
} as const;

/** Public path of the brand mark (transparent star PNG). Also the structured-data logo. */
export const BRAND_MARK_SRC = "/brand/star.png";

export const marketingNav = [
  { href: "/", key: "home" },
  { href: "/contact", key: "contact" },
  { href: "/legal", key: "legal" },
] as const;

export const legalPages = [
  { href: "/legal/privacy", key: "privacy" },
  { href: "/legal/terms", key: "terms" },
  { href: "/legal/refund", key: "refund" },
  { href: "/legal/cookies", key: "cookies" },
] as const;

export type LegalKey = (typeof legalPages)[number]["key"];

export const LEGAL_LAST_UPDATED = "2026-10-27";

/**
 * Recording of the agent taking a booking in Georgian, played by the home
 * page's call sample section (components/marketing/call-sample.tsx).
 * TODO(owner): record one (e.g. on the web voice agent with Azure TTS), save
 * it as public/audio/agent-sample-ka.mp3 and set this to
 * "/audio/agent-sample-ka.mp3". While null the play button is disabled
 * ("Recording coming soon") and nothing pretends to play.
 */
export const AGENT_SAMPLE_AUDIO_SRC: string | null = null;

/**
 * Optional: the second at which each transcript line (t.sample.lines, same
 * order) starts in the recording. With cues the playing line is highlighted;
 * without them no line is.
 */
export const AGENT_SAMPLE_CUES: readonly number[] | null = null;
