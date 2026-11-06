import s from "./ai-mark.module.css";

export type AiMarkVariant = "orb" | "bars" | "wave";

/** The site's AI mark style. Change it here to switch everywhere. */
export const AI_MARK_VARIANT: AiMarkVariant = "orb";

/**
 * The DevskStudio AI voice mark: a round, pure-CSS animated badge (decorative).
 * sm = 34px (call rows), lg = 40px (card header). Colours come from the site
 * tokens (the site is dark only).
 */
export function AiMark({ size = "sm", variant = AI_MARK_VARIANT, className }: { size?: "sm" | "lg"; variant?: AiMarkVariant; className?: string }) {
  const cls = [s.mark, s[variant], size === "lg" ? s.lg : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={cls} aria-hidden="true">
      {variant === "orb" && <i className={s.core} />}
      {variant === "bars" && (
        <>
          <i className={s.bar} />
          <i className={s.bar} />
          <i className={s.bar} />
          <i className={s.bar} />
        </>
      )}
      {variant === "wave" && (
        <>
          <i className={s.rp} />
          <i className={s.rp} />
          <i className={s.dot} />
        </>
      )}
    </span>
  );
}
