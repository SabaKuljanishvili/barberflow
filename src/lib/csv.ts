// RFC 4180 CSV for the salon data export. Cells that a spreadsheet would run
// as a formula (= + - @, tab, CR) get a leading apostrophe (OWASP CSV
// injection advice). A UTF-8 BOM makes Excel read Georgian correctly.

type Cell = string | number | boolean | null | undefined;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
