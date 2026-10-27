// Country calling codes offered next to phone inputs. Georgia is the default;
// the rest are sorted by name. Values are ISO 3166 codes because some dial
// codes are shared (+1, +7).

export type PhoneCountry = { iso: string; name: string; dial: string };

export const DEFAULT_PHONE_COUNTRY = "GE";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "GE", name: "Georgia", dial: "995" },
  { iso: "AM", name: "Armenia", dial: "374" },
  { iso: "AT", name: "Austria", dial: "43" },
  { iso: "AZ", name: "Azerbaijan", dial: "994" },
  { iso: "BY", name: "Belarus", dial: "375" },
  { iso: "BE", name: "Belgium", dial: "32" },
  { iso: "BG", name: "Bulgaria", dial: "359" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "CY", name: "Cyprus", dial: "357" },
  { iso: "CZ", name: "Czechia", dial: "420" },
  { iso: "DK", name: "Denmark", dial: "45" },
  { iso: "EE", name: "Estonia", dial: "372" },
  { iso: "FI", name: "Finland", dial: "358" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "GR", name: "Greece", dial: "30" },
  { iso: "HU", name: "Hungary", dial: "36" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "IT", name: "Italy", dial: "39" },
  { iso: "KZ", name: "Kazakhstan", dial: "7" },
  { iso: "KG", name: "Kyrgyzstan", dial: "996" },
  { iso: "LV", name: "Latvia", dial: "371" },
  { iso: "LT", name: "Lithuania", dial: "370" },
  { iso: "MD", name: "Moldova", dial: "373" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "NO", name: "Norway", dial: "47" },
  { iso: "PL", name: "Poland", dial: "48" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "RO", name: "Romania", dial: "40" },
  { iso: "RU", name: "Russia", dial: "7" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "ES", name: "Spain", dial: "34" },
  { iso: "SE", name: "Sweden", dial: "46" },
  { iso: "CH", name: "Switzerland", dial: "41" },
  { iso: "TR", name: "Türkiye", dial: "90" },
  { iso: "UA", name: "Ukraine", dial: "380" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "UZ", name: "Uzbekistan", dial: "998" },
];

const BY_ISO = new Map(PHONE_COUNTRIES.map((c) => [c.iso, c]));

export function phoneCountry(iso: string | null | undefined): PhoneCountry | undefined {
  return iso ? BY_ISO.get(iso.toUpperCase()) : undefined;
}

/** Splits a stored E.164 number into a listed country and the national part. */
export function splitE164(e164: string | null | undefined): { iso: string; national: string } {
  if (!e164?.startsWith("+")) return { iso: DEFAULT_PHONE_COUNTRY, national: e164 ?? "" };
  const digits = e164.slice(1);
  // Longest dial code wins; list order breaks ties (+1 -> Canada before US is
  // harmless because both produce the same number).
  const match = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
  if (!match) return { iso: DEFAULT_PHONE_COUNTRY, national: e164 };
  return { iso: match.iso, national: digits.slice(match.dial.length) };
}

export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
