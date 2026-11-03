"use client";

import { useState } from "react";

/**
 * Phones (< 768px): a segmented control above the plan cards; CSS shows only
 * the card whose data-plan matches data-active. Desktop shows all cards and
 * hides the control, so nothing changes there.
 */
export function PlanSwitcher({
  plans,
  defaultId,
  label,
  children,
}: {
  plans: { id: string; name: string }[];
  defaultId: string;
  label: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(defaultId);
  return (
    <div className="plan-switch" data-active={active}>
      <div className="seg m-only" role="radiogroup" aria-label={label}>
        {plans.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === active} onClick={() => setActive(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
