import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { name?: string; color?: string };
  const existing = await sql<{ id: string; name: string; color: string }>(
    "select id, name, color from categories where id = $1 and user_id = $2",
    [id, user.id],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Kategoriya topilmadi." }, { status: 404 });
  }
  const name = body.name?.trim() || existing[0].name;
  const color = body.color?.trim() || existing[0].color;
  await sql("update categories set name = $1, color = $2 where id = $3 and user_id = $4", [
    name,
    color,
    id,
    user.id,
  ]);
  return NextResponse.json({ id, name, color });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const { id } = await context.params;
  await sql("update tasks set category_id = null where category_id = $1 and user_id = $2", [
    id,
    user.id,
  ]);
  await sql("delete from categories where id = $1 and user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
