import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const settings = await getSettings(user.id);
  const rows = await sql<{
    id: string;
    mode: string;
    planned_seconds: number;
    elapsed_seconds: number;
    status: string;
    task_id: string | null;
    started_at: string;
    ended_at: string | null;
    note: string;
  }>(
    `select id, mode, planned_seconds, elapsed_seconds, status, task_id,
            started_at::text as started_at, ended_at::text as ended_at, note
     from focus_sessions where user_id = $1
     order by started_at desc limit 30`,
    [user.id],
  );
  const totals = await sql<{ seconds: number | string; count: number | string }>(
    `select coalesce(sum(elapsed_seconds),0) as seconds, count(*)::int as count
     from focus_sessions where user_id = $1 and status = 'completed'`,
    [user.id],
  );
  return NextResponse.json({
    settings: {
      workMinutes: settings.focusWorkMinutes,
      breakMinutes: settings.focusBreakMinutes,
    },
    sessions: rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      plannedSeconds: Number(r.planned_seconds),
      elapsedSeconds: Number(r.elapsed_seconds),
      status: r.status,
      taskId: r.task_id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      note: r.note,
    })),
    totals: {
      seconds: Number(totals[0]?.seconds ?? 0),
      count: Number(totals[0]?.count ?? 0),
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as {
    mode?: string;
    plannedSeconds?: number;
    elapsedSeconds?: number;
    status?: string;
    taskId?: string | null;
    note?: string;
  };
  const settings = await getSettings(user.id);
  const planned =
    Number(body.plannedSeconds) ||
    (body.mode === "break" ? settings.focusBreakMinutes : settings.focusWorkMinutes) * 60;
  const elapsed = Math.max(0, Number(body.elapsedSeconds) || 0);
  const status = body.status === "aborted" ? "aborted" : "completed";
  if (elapsed < 5 && status === "completed") {
    return NextResponse.json({ error: "Sessiya juda qisqa." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const ended = new Date();
  const started = new Date(ended.getTime() - elapsed * 1000);
  await sql(
    `insert into focus_sessions (
       id, user_id, mode, planned_seconds, elapsed_seconds, status, task_id, started_at, ended_at, note
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      user.id,
      body.mode || "pomodoro",
      planned,
      elapsed,
      status,
      body.taskId || null,
      started.toISOString(),
      ended.toISOString(),
      body.note?.trim() || "",
    ],
  );
  return NextResponse.json({ id }, { status: 201 });
}
