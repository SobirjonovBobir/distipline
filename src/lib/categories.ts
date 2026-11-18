import { sql } from "./db";
import { PERSONAL_CATEGORY_NAME } from "./personal";

export const DEFAULT_CATEGORIES = [
  { name: "Salomatlik", color: "#2f7a55" },
  { name: "Ish", color: "#1f4d6d" },
  { name: "O‘qish", color: "#8a5a1a" },
  { name: PERSONAL_CATEGORY_NAME, color: "#5b4b8a" },
] as const;

export async function ensureDefaultCategories(userId: string) {
  const existing = await sql<{ id: string }>(
    "select id from categories where user_id = $1 limit 1",
    [userId],
  );
  if (existing.length === 0) {
    let order = 1;
    for (const cat of DEFAULT_CATEGORIES) {
      await sql(
        `insert into categories (id, user_id, name, color, sort_order)
         values ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), userId, cat.name, cat.color, order],
      );
      order += 1;
    }
    return;
  }
  // Existing users: ensure Shaxsiy exists without wiping other categories
  await ensurePersonalTaskCategory(userId);
}

/** Idempotent: add task category "Shaxsiy" if the user does not already have it. */
export async function ensurePersonalTaskCategory(userId: string) {
  const found = await sql<{ id: string }>(
    `select id from categories
     where user_id = $1 and lower(trim(name)) = lower($2)
     limit 1`,
    [userId, PERSONAL_CATEGORY_NAME],
  );
  if (found.length > 0) return found[0].id;
  const orderRows = await sql<{ max: number | null }>(
    "select max(sort_order) as max from categories where user_id = $1",
    [userId],
  );
  const id = crypto.randomUUID();
  await sql(
    `insert into categories (id, user_id, name, color, sort_order)
     values ($1, $2, $3, $4, $5)`,
    [id, userId, PERSONAL_CATEGORY_NAME, "#5b4b8a", (orderRows[0]?.max ?? 0) + 1],
  );
  return id;
}
