/** Maps an SMS reply (English or Georgian) to a status change. */
export function parseReply(body: string): "confirmed" | "cancelled" | null {
  const word = body.trim().toLowerCase().split(/\s+/)[0]?.replace(/[.!,]+$/u, "") ?? "";
  if (["c", "confirm", "yes", "y", "ok", "კი", "დიახ", "ჰო", "ხო", "ვადასტურებ"].includes(word)) return "confirmed";
  if (["x", "cancel", "no", "n", "არა", "გაუქმება", "ვაუქმებ"].includes(word)) return "cancelled";
  return null;
}
