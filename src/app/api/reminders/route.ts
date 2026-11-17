import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type ReminderRow = {
  id: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }

  const rows = await sql<ReminderRow>(
    `select id, body, kind, read, created_at::text as created_at
     from reminders
     where user_id = $1
     order by created_at desc
     limit 20`,
    [user.id],
  );

  return NextResponse.json({
    reminders: rows.map((r) => ({
      id: r.id,
      body: r.body,
      kind: r.kind,
      read: r.read,
      createdAt: r.created_at,
    })),
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; all?: boolean };
  if (body.all) {
    await sql("update reminders set read = true where user_id = $1", [user.id]);
  } else if (body.id) {
    await sql("update reminders set read = true where id = $1 and user_id = $2", [
      body.id,
      user.id,
    ]);
  } else {
    return NextResponse.json({ error: "Eslatma tanlanmadi." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
