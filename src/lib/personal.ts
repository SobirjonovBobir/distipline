/** Canonical personal/vault category name (Uzbek Latin). */
export const PERSONAL_CATEGORY_NAME = "Shaxsiy";

export function normalizeCategoryKey(name: string | null | undefined): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/ʻ/g, "'")
    .replace(/’/g, "'")
    .replace(/`/g, "'");
}

/** True when category name is the personal vault ("Shaxsiy"). */
export function isPersonalCategoryName(name: string | null | undefined): boolean {
  return normalizeCategoryKey(name) === "shaxsiy";
}

/** Mask sensitive text when the eye toggle hides personal content. */
export function privacyText(value: string | null | undefined, hidden: boolean, fallback = "••••••"): string {
  if (!hidden) return value || "";
  const raw = (value || "").trim();
  if (!raw) return fallback;
  return fallback;
}
