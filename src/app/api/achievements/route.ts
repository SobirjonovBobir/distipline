import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import { computeStreak, summarizeRange } from "@/lib/stats-core";
import { startOfMonthIso, endOfMonthIso } from "@/lib/dates";

const CATALOG = [
  { code: "first_perfect", title: "Birinchi mukammal kun", kind: "streak", min: 1 },
  { code: "streak_3", title: "3 kunlik zanjir", kind: "streak", min: 3 },
  { code: "streak_7", title: "7 kunlik zanjir", kind: "streak", min: 7 },
  { code: "month_80", title: "Oylik 80%+", kind: "month80", min: 80 },
] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }

  const date = todayIso();
  const streak = await computeStreak(user.id, date);
  const month = await summarizeRange(user.id, startOfMonthIso(date), endOfMonthIso(date));

  for (const item of CATALOG) {
    const unlocked =
      item.kind === "streak"
        ? streak >= item.min
        : (month.percent ?? 0) >= item.min;
    if (!unlocked) continue;
    await sql(
      `insert into achievements (id, user_id, code, title)
       values ($1, $2, $3, $4)
       on conflict (user_id, code) do nothing`,
      [crypto.randomUUID(), user.id, item.code, item.title],
    );
  }

  const rows = await sql<{ code: string; title: string; unlocked_at: string }>(
    `select code, title, unlocked_at::text as unlocked_at
     from achievements where user_id = $1 order by unlocked_at asc`,
    [user.id],
  );

  return NextResponse.json({
    streak,
    monthPercent: month.percent,
    achievements: rows,
    catalog: CATALOG.map((c) => ({
      code: c.code,
      title: c.title,
      unlocked: rows.some((r) => r.code === c.code),
    })),
  });
}
