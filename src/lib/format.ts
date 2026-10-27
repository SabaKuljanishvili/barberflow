type ClientLike = { first_name: string; last_name: string; phone_number: string } | null;

export function clientName(c: ClientLike, unknown = "Unknown client"): string {
  if (!c) return unknown;
  return `${c.first_name} ${c.last_name}`.trim() || c.phone_number;
}

const GEL = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Georgian lari, written the local way: "25.00 ₾". */
export function money(value: number | string): string {
  return `${GEL.format(Number(value))} ₾`;
}

/** Lari amount as the voice agent says it: "25" or "12.50" (the unit word comes from the dictionary). */
export function spokenAmount(value: number | string): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** English spoken form, kept for callers that need the unit inline: "25 lari". */
export function spokenMoney(value: number | string): string {
  return `${spokenAmount(value)} lari`;
}
