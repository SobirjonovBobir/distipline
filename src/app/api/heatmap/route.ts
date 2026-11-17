import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addDaysIso, todayIso } from "@/lib/dates";
import { loadDefs, summarizeRange } from "@/lib/stats-core";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const days = Math.min(
    370,
    Math.max(30, Number(new URL(request.url).searchParams.get("days") || "140")),
  );
  const end = todayIso();
  const start = addDaysIso(end, -(days - 1));
  const defs = await loadDefs(user.id);
  const range = await summarizeRange(user.id, start, end, defs);
  return NextResponse.json({
    start,
    end,
    days: range.trend.map((d) => ({
      date: d.date,
      total: d.total,
      completed: d.completed,
      percent: d.percent,
      tone: d.tone,
      label: d.label,
      level:
        d.total <= 0 ? 0 : (d.percent ?? 0) >= 80 ? 4 : (d.percent ?? 0) >= 50 ? 3 : (d.percent ?? 0) > 0 ? 2 : 1,
    })),
  });
}
