import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const rows = await sql<{ id: string; body: string; pinned: boolean }>(
    `select id, body, pinned from notes where user_id = $1
     order by pinned desc, updated_at desc limit 50`,
    [user.id],
  );
  return NextResponse.json({
    notes: rows.map((r) => ({ id: r.id, body: r.body, pinned: r.pinned })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const body = (await request.json()) as { body?: string };
  const text = body.body?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Qayd matnini yozing." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await sql(
    `insert into notes (id, user_id, body) values ($1, $2, $3)`,
    [id, user.id, text],
  );
  return NextResponse.json({ id }, { status: 201 });
}
