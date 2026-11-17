import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isValidDateIso, todayIso } from "@/lib/dates";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });

  const goals = await sql<{
    id: string;
    title: string;
    description: string;
    target_count: number;
    unit: string;
    period: string;
    start_date: string;
    end_date: string | null;
    category_id: string | null;
  }>(
    `select id, title, description, target_count, unit, period,
            start_date::text as start_date, end_date::text as end_date, category_id
     from goals where user_id = $1 and archived = false
     order by created_at desc`,
    [user.id],
  );

  const progress = await sql<{ goal_id: string; amount: number | string }>(
    `select goal_id, coalesce(sum(amount),0) as amount
     from goal_progress where user_id = $1
     group by goal_id`,
    [user.id],
  );
  const byGoal = new Map(progress.map((p) => [p.goal_id, Number(p.amount)]));

  return NextResponse.json({
    goals: goals.map((g) => {
      const current = byGoal.get(g.id) ?? 0;
      const target = Number(g.target_count) || 1;
      const percent = Math.min(100, Math.round((current / target) * 100));
      return {
        id: g.id,
        title: g.title,
        description: g.description,
        targetCount: target,
        unit: g.unit,
        period: g.period,
        startDate: String(g.start_date).slice(0, 10),
        endDate: g.end_date ? String(g.end_date).slice(0, 10) : null,
        categoryId: g.category_id,
        current,
        percent,
        done: current >= target,
      };
    }),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    targetCount?: number;
    unit?: string;
    period?: string;
    startDate?: string;
    endDate?: string | null;
  };
  const title = body.title?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Maqsad nomini yozing." }, { status: 400 });
  const startDate = body.startDate && isValidDateIso(body.startDate) ? body.startDate : todayIso();
  const id = crypto.randomUUID();
  await sql(
    `insert into goals (id, user_id, title, description, target_count, unit, period, start_date, end_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      user.id,
      title,
      body.description?.trim() || "",
      Math.max(1, Number(body.targetCount) || 1),
      body.unit?.trim() || "marta",
      body.period || "week",
      startDate,
      body.endDate && isValidDateIso(body.endDate) ? body.endDate : null,
    ],
  );
  return NextResponse.json({ id }, { status: 201 });
}
