import { sql } from "./db";

export const DEFAULT_CATEGORIES = [
  { name: "Salomatlik", color: "#2f7a55" },
  { name: "Ish", color: "#1f4d6d" },
  { name: "O‘qish", color: "#8a5a1a" },
  { name: "Shaxsiy", color: "#5b4b8a" },
] as const;

export async function ensureDefaultCategories(userId: string) {
  const existing = await sql<{ id: string }>(
    "select id from categories where user_id = $1 limit 1",
    [userId],
  );
  if (existing.length > 0) return;
  let order = 1;
  for (const cat of DEFAULT_CATEGORIES) {
    await sql(
      `insert into categories (id, user_id, name, color, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), userId, cat.name, cat.color, order],
    );
    order += 1;
  }
}
