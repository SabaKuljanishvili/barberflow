"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Read-only value with a copy button. Labels come from the server dictionary. */
export function CopyField({ label, value, copyLabel, copiedLabel }: { label: string; value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 break-all rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink">{value}</code>
        <button
          type="button"
          className="btn-secondary shrink-0 px-3"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the value is still selectable.
            }
          }}
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          <span className="sr-only sm:not-sr-only sm:ml-1">{copied ? copiedLabel : copyLabel}</span>
        </button>
        <span role="status" className="sr-only">
          {copied ? copiedLabel : ""}
        </span>
      </div>
    </div>
  );
}
