/** Space-grouped amount helpers for cash inputs (Uzbek-friendly: 2000000 → "2 000 000"). */

const GROUP_SEP = /[\s\u00A0\u202F]/g;

/** Strip grouping spaces / NBSP and non-numeric noise; keep digits and at most one decimal. */
export function sanitizeAmountDigits(raw: string): string {
  let cleaned = raw.replace(GROUP_SEP, "").replace(",", ".");
  cleaned = cleaned.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot !== -1) {
    cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  }
  return cleaned;
}

/** Format while typing: group integer thousands with regular spaces. */
export function formatAmountInput(raw: string): string {
  const cleaned = sanitizeAmountDigits(raw);
  if (!cleaned) return "";

  const hasDot = cleaned.includes(".");
  const [intRaw, frac] = cleaned.split(".");
  const intDigits = intRaw.replace(/^0+(?=\d)/, "") || (hasDot ? "0" : "");
  if (!intDigits && !hasDot) return "";

  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (!hasDot) return grouped;
  return frac !== undefined ? `${grouped}.${frac}` : `${grouped}.`;
}

/** Parse a formatted amount string to a number for API/DB (no spaces). */
export function parseAmountInput(raw: string): number {
  const cleaned = sanitizeAmountDigits(raw);
  if (!cleaned || cleaned === ".") return 0;
  return Number(cleaned) || 0;
}
