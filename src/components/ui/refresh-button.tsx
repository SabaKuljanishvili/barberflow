"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function RefreshButton({ label, className = "btn-secondary" }: { label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} aria-busy={pending} onClick={() => start(() => router.refresh())}>
      <RotateCcw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} />
      <span className="ml-1">{label}</span>
    </button>
  );
}
