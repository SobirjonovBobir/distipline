import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isValidDateIso, todayIso } from "@/lib/dates";
import { sql } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // log progress amount
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json()) as { amount?: number; date?: string; note?: string; action?: string };

  const owned = await sql<{ id: string }>(
    "select id from goals where id = $1 and user_id = $2 and archived = false",
    [id, user.id],
  );
  if (owned.length === 0) return NextResponse.json({ error: "Maqsad topilmadi." }, { status: 404 });

  if (body.action === "archive") {
    await sql("update goals set archived = true, updated_at = now() where id = $1 and user_id = $2", [
      id,
      user.id,
    ]);
    return NextResponse.json({ ok: true });
  }

  const amount = Math.max(1, Number(body.amount) || 1);
  const date = body.date && isValidDateIso(body.date) ? body.date : todayIso();
  await sql(
    `insert into goal_progress (id, goal_id, user_id, progress_date, amount, note)
     values ($1,$2,$3,$4,$5,$6)`,
    [crypto.randomUUID(), id, user.id, date, amount, body.note?.trim() || ""],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await context.params;
  await sql("delete from goals where id = $1 and user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
