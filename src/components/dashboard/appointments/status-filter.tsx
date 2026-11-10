"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

/** List view status filter: a chip-styled select that navigates on change. */
export function StatusFilter({ value, options, label }: { value: string; options: { value: string; label: string; href: string }[]; label: string }) {
  const router = useRouter();
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (o) router.push(o.href, { scroll: false });
        }}
        className="h-10 cursor-pointer appearance-none rounded-full border border-ap-chip-line bg-transparent pr-8 pl-3 text-xs font-semibold text-ap-ink2 hover:border-ap-sel-line"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-ap-ink2" strokeWidth={2.6} />
    </span>
  );
}
