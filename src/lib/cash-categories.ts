import { sql } from "./db";

export type CashCategory = {
  id: string;
  name: string;
  color: string;
  kind: "income" | "expense" | "both";
  sortOrder: number;
};

export const DEFAULT_CASH_CATEGORIES = [
  { name: "Oziq-ovqat", color: "#2f7a55", kind: "expense" as const },
  { name: "Transport", color: "#1f4d6d", kind: "expense" as const },
  { name: "Uy", color: "#8a5a1a", kind: "expense" as const },
  { name: "Ta’lim", color: "#5b4b8a", kind: "expense" as const },
  { name: "Salomatlik", color: "#c6473a", kind: "expense" as const },
  { name: "Dam olish", color: "#3a7ca5", kind: "expense" as const },
  { name: "Maosh", color: "#2f7a55", kind: "income" as const },
  { name: "Boshqa", color: "#6b7280", kind: "both" as const },
];

function mapRow(r: {
  id: string;
  name: string;
  color: string;
  kind: string;
  sort_order: number | string;
}): CashCategory {
  const kind = r.kind === "income" || r.kind === "expense" ? r.kind : "both";
  return {
    id: r.id,
    name: r.name,
    color: r.color || "#2f7a55",
    kind,
    sortOrder: Number(r.sort_order) || 0,
  };
}

export async function ensureDefaultCashCategories(userId: string) {
  const existing = await sql<{ id: string }>(
    "select id from cash_categories where user_id = $1 limit 1",
    [userId],
  );
  if (existing.length > 0) return;
  let order = 1;
  for (const cat of DEFAULT_CASH_CATEGORIES) {
    await sql(
      `insert into cash_categories (id, user_id, name, color, kind, sort_order)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, name) do nothing`,
      [crypto.randomUUID(), userId, cat.name, cat.color, cat.kind, order],
    );
    order += 1;
  }
}

export async function listCashCategories(userId: string): Promise<CashCategory[]> {
  await ensureDefaultCashCategories(userId);
  const rows = await sql<{
    id: string;
    name: string;
    color: string;
    kind: string;
    sort_order: number | string;
  }>(
    `select id, name, color, kind, sort_order
     from cash_categories
     where user_id = $1
     order by sort_order asc, name asc`,
    [userId],
  );
  return rows.map(mapRow);
}

export async function createCashCategory(
  userId: string,
  input: { name: string; color?: string; kind?: string },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Kategoriya nomini yozing.");
  const color = input.color?.trim() || "#2f7a55";
  const kind =
    input.kind === "income" || input.kind === "expense" ? input.kind : "both";
  const orderRows = await sql<{ max: number | null }>(
    "select max(sort_order) as max from cash_categories where user_id = $1",
    [userId],
  );
  const id = crypto.randomUUID();
  await sql(
    `insert into cash_categories (id, user_id, name, color, kind, sort_order)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, userId, name, color, kind, (orderRows[0]?.max ?? 0) + 1],
  );
  return { id, name, color, kind, sortOrder: (orderRows[0]?.max ?? 0) + 1 } as CashCategory;
}

export async function updateCashCategory(
  userId: string,
  id: string,
  patch: { name?: string; color?: string; kind?: string },
) {
  const existing = await sql<{ id: string; name: string; color: string; kind: string }>(
    "select id, name, color, kind from cash_categories where id = $1 and user_id = $2",
    [id, userId],
  );
  if (!existing[0]) throw new Error("Kategoriya topilmadi.");
  const prev = existing[0];
  const name = patch.name?.trim() || prev.name;
  const color = patch.color?.trim() || prev.color;
  const kind =
    patch.kind === "income" || patch.kind === "expense" || patch.kind === "both"
      ? patch.kind
      : prev.kind === "income" || prev.kind === "expense"
        ? prev.kind
        : "both";

  await sql(
    `update cash_categories set name = $1, color = $2, kind = $3
     where id = $4 and user_id = $5`,
    [name, color, kind, id, userId],
  );

  if (name !== prev.name) {
    await sql(
      `update cash_transactions set category = $1
       where user_id = $2 and category = $3`,
      [name, userId, prev.name],
    );
    await sql(
      `update cash_budgets set category = $1
       where user_id = $2 and category = $3`,
      [name, userId, prev.name],
    );
  }

  return { id, name, color, kind, sortOrder: 0 } as CashCategory;
}

export async function deleteCashCategory(userId: string, id: string) {
  const existing = await sql<{ id: string; name: string }>(
    "select id, name from cash_categories where id = $1 and user_id = $2",
    [id, userId],
  );
  if (!existing[0]) return;
  const name = existing[0].name;
  await sql(`delete from cash_categories where id = $1 and user_id = $2`, [id, userId]);
  await sql(
    `update cash_transactions set category = 'Boshqa'
     where user_id = $1 and category = $2`,
    [userId, name],
  );
  await sql(`delete from cash_budgets where user_id = $1 and category = $2`, [userId, name]);
}
