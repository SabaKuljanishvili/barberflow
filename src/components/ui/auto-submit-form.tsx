"use client";

/**
 * GET filter form that applies on every change. The submit button is only
 * rendered for no-JS visitors (inside <noscript>).
 */
export function AutoSubmitForm({ children, className, label, submitLabel }: { children: React.ReactNode; className?: string; label: string; submitLabel: string }) {
  return (
    <form method="get" className={className} aria-label={label} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
      <noscript>
        <button type="submit" className="btn-secondary">
          {submitLabel}
        </button>
      </noscript>
    </form>
  );
}
