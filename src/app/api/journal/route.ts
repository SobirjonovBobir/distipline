import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isValidDateIso, todayIso } from "@/lib/dates";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam && isValidDateIso(dateParam) ? dateParam : null;

  if (date) {
    const rows = await sql<{
      id: string;
      entry_date: string;
      mood: string;
      body: string;
      gratitude: string;
    }>(
      `select id, entry_date::text as entry_date, mood, body, gratitude
       from journal_entries where user_id = $1 and entry_date = $2 limit 1`,
      [user.id, date],
    );
    return NextResponse.json({
      entry: rows[0]
        ? {
            id: rows[0].id,
            date: String(rows[0].entry_date).slice(0, 10),
            mood: rows[0].mood,
            body: rows[0].body,
            gratitude: rows[0].gratitude,
          }
        : null,
    });
  }

  const rows = await sql<{
    id: string;
    entry_date: string;
    mood: string;
    body: string;
    gratitude: string;
  }>(
    `select id, entry_date::text as entry_date, mood, body, gratitude
     from journal_entries where user_id = $1
     order by entry_date desc limit 40`,
    [user.id],
  );
  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      date: String(r.entry_date).slice(0, 10),
      mood: r.mood,
      body: r.body,
      gratitude: r.gratitude,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as {
    date?: string;
    mood?: string;
    body?: string;
    gratitude?: string;
  };
  const date = body.date && isValidDateIso(body.date) ? body.date : todayIso();
  const text = body.body?.trim() || "";
  const gratitude = body.gratitude?.trim() || "";
  const mood = body.mood || "neutral";
  if (!text && !gratitude) {
    return NextResponse.json({ error: "Kundalik matnini yozing." }, { status: 400 });
  }

  const existing = await sql<{ id: string }>(
    "select id from journal_entries where user_id = $1 and entry_date = $2",
    [user.id, date],
  );
  if (existing.length > 0) {
    await sql(
      `update journal_entries set mood=$1, body=$2, gratitude=$3, updated_at=now()
       where id=$4 and user_id=$5`,
      [mood, text, gratitude, existing[0].id, user.id],
    );
    return NextResponse.json({ id: existing[0].id });
  }
  const id = crypto.randomUUID();
  await sql(
    `insert into journal_entries (id, user_id, entry_date, mood, body, gratitude)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, user.id, date, mood, text, gratitude],
  );
  return NextResponse.json({ id }, { status: 201 });
}
