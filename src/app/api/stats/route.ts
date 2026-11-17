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
import {
  computeStreak,
  loadDefs,
  summarizeByCategory,
  summarizeRange,
} from "@/lib/stats-core";

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
  const prevWeekStart = addDaysIso(weekStart, -7);
  const prevWeekEnd = addDaysIso(weekEnd, -7);
  const day = await summarizeRange(user.id, date, date, defs);
  const week = await summarizeRange(user.id, weekStart, weekEnd, defs);
  const prevWeek = await summarizeRange(user.id, prevWeekStart, prevWeekEnd, defs);
  const month = await summarizeRange(user.id, monthStart, monthEnd, defs);
  const last7 = await summarizeRange(user.id, trendStart, date, defs);
  const categories = await summarizeByCategory(user.id, weekStart, weekEnd, defs);
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

  let weekDelta: number | null = null;
  if (week.percent !== null && prevWeek.percent !== null) {
    weekDelta = week.percent - prevWeek.percent;
  }

  const pack = (s: typeof day) => ({
    completed: s.completed,
    total: s.total,
    percent: s.percent,
    tone: s.tone,
    label: s.label,
    daysWithTasks: s.daysWithTasks,
  });

  return NextResponse.json({
    date,
    ranges: {
      week: { start: weekStart, end: weekEnd },
      prevWeek: { start: prevWeekStart, end: prevWeekEnd },
      month: { start: monthStart, end: monthEnd },
    },
    day: pack(day),
    week: pack(week),
    prevWeek: pack(prevWeek),
    month: pack(month),
    categories,
    trend: last7.trend,
    trendDelta,
    weekDelta,
    streak,
  });
}
