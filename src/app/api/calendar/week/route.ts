import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  addDaysIso,
  endOfWeekIso,
  isValidDateIso,
  startOfWeekIso,
  todayIso,
} from "@/lib/dates";
import { tasksForDate } from "@/lib/tasks";
import { progressDisplay } from "@/lib/progress";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const dateParam = new URL(request.url).searchParams.get("date");
  const anchor = dateParam && isValidDateIso(dateParam) ? dateParam : todayIso();
  const start = startOfWeekIso(anchor);
  const end = endOfWeekIso(anchor);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso(start, i);
    const { tasks, progress } = await tasksForDate(user.id, iso);
    days.push({
      date: iso,
      tasks,
      progress,
      ...progressDisplay(progress.completed, progress.total),
    });
  }
  return NextResponse.json({ start, end, days });
}
