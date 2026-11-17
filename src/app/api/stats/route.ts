import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import {
  addDaysIso,
  endOfMonthIso,
  endOfWeekIso,
  isValidDateIso,
  startOfMonthIso,
  startOfWeekIso,
  todayIso,
} from "@/lib/dates";
import { computeStreak, loadDefs, summarizeRange } from "@/lib/stats-core";

function normalizeDate(value: string | null) {
  if (value && isValidDateIso(value)) return value;
  return todayIso();
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  await ensureDefaultCategories(user.id);

  const { searchParams } = new URL(request.url);
  const date = normalizeDate(searchParams.get("date"));
  const weekStart = startOfWeekIso(date);
  const weekEnd = endOfWeekIso(date);
  const monthStart = startOfMonthIso(date);
  const monthEnd = endOfMonthIso(date);
  const trendStart = addDaysIso(date, -6);

  const defs = await loadDefs(user.id);
  const day = await summarizeRange(user.id, date, date, defs);
  const week = await summarizeRange(user.id, weekStart, weekEnd, defs);
  const month = await summarizeRange(user.id, monthStart, monthEnd, defs);
  const last7 = await summarizeRange(user.id, trendStart, date, defs);
  const streak = await computeStreak(user.id, date);

  const withData = last7.trend.filter((t) => t.total > 0);
  let trendDelta: number | null = null;
  if (
    withData.length >= 2 &&
    withData[0].percent !== null &&
    withData[withData.length - 1].percent !== null
  ) {
    trendDelta =
      (withData[withData.length - 1].percent as number) - (withData[0].percent as number);
  }

  return NextResponse.json({
    date,
    ranges: {
      week: { start: weekStart, end: weekEnd },
      month: { start: monthStart, end: monthEnd },
    },
    day: {
      completed: day.completed,
      total: day.total,
      percent: day.percent,
      tone: day.tone,
      label: day.label,
      daysWithTasks: day.daysWithTasks,
    },
    week: {
      completed: week.completed,
      total: week.total,
      percent: week.percent,
      tone: week.tone,
      label: week.label,
      daysWithTasks: week.daysWithTasks,
    },
    month: {
      completed: month.completed,
      total: month.total,
      percent: month.percent,
      tone: month.tone,
      label: month.label,
      daysWithTasks: month.daysWithTasks,
    },
    trend: last7.trend,
    trendDelta,
    streak,
  });
}
