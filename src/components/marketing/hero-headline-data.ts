/**
 * Splits the hero headline into words and letters for the CSS letter
 * cascade (see `.headline` in app/landing.css). Pure and deterministic,
 * so the server renders the same markup every time.
 */

export type HeadlineText = { before: string; green: string; after: string };

export type HeadlineChar = {
  ch: string;
  /** Running index across the whole headline (spaces not counted): --i. */
  i: number;
  /** Index within the green phrase (--j), or null outside it. */
  j: number | null;
};

export type HeadlineParts = {
  words: HeadlineChar[][];
  /** ms when the last letter has landed: the glint starts here. */
  end: number;
  /** ms when the lede and buttons start rising. */
  after: number;
  /** Full plain sentence for aria-label. */
  label: string;
};

export const CASCADE = { start: 150, step: 24, duration: 700, leadIn: 300 } as const;

export function splitHeadline({ before, green, after }: HeadlineText): HeadlineParts {
  const words: HeadlineChar[][] = [];
  let cur: HeadlineChar[] = [];
  let i = 0;
  let j = 0;
  for (const [text, isGreen] of [
    [before, false],
    [green, true],
    [after, false],
  ] as const) {
    // Array.from keeps every code point whole.
    for (const ch of Array.from(text)) {
      if (/\s/.test(ch)) {
        if (cur.length) words.push(cur);
        cur = [];
      } else {
        // Punctuation after the green phrase joins its last word (no space between them).
        cur.push({ ch, i: i++, j: isGreen ? j++ : null });
      }
    }
  }
  if (cur.length) words.push(cur);

  const end = CASCADE.start + Math.max(i - 1, 0) * CASCADE.step + CASCADE.duration;
  return { words, end, after: end - CASCADE.leadIn, label: `${before}${green}${after}` };
}
