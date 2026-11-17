import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { sql } from "@/lib/db";
import { listCategories } from "@/lib/tasks";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  await ensureDefaultCategories(user.id);
  return NextResponse.json({ categories: await listCategories(user.id) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const body = (await request.json()) as { name?: string; color?: string };
  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Kategoriya nomini yozing." }, { status: 400 });
  }
  const color = body.color?.trim() || "#2f7a55";
  const orderRows = await sql<{ max: number | null }>(
    "select max(sort_order) as max from categories where user_id = $1",
    [user.id],
  );
  const id = crypto.randomUUID();
  await sql(
    `insert into categories (id, user_id, name, color, sort_order) values ($1,$2,$3,$4,$5)`,
    [id, user.id, name, color, (orderRows[0]?.max ?? 0) + 1],
  );
  return NextResponse.json({ id, name, color }, { status: 201 });
}
