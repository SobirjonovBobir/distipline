import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { isValidDateIso, todayIso } from "@/lib/dates";
import { maybeCreateIncompleteReminder } from "@/lib/reminders";
import type { ScheduleType } from "@/lib/schedule";
import { createTask, listCategories, tasksForDate } from "@/lib/tasks";

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
  const checkReminders = searchParams.get("remind") === "1" && date === todayIso();

  const { tasks, progress } = await tasksForDate(user.id, date);
  const categories = await listCategories(user.id);

  let reminder = null;
  if (checkReminders && progress.total > 0 && (progress.percent ?? 0) < 100) {
    const { getSettings } = await import("@/lib/settings");
    const prefs = await getSettings(user.id);
    if (prefs.notifyIncomplete) {
      reminder = await maybeCreateIncompleteReminder(user.id, date);
    }
  }

  return NextResponse.json({ date, tasks, progress, categories, reminder });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  await ensureDefaultCategories(user.id);

  const body = (await request.json()) as {
    title?: string;
    date?: string;
    scheduleType?: ScheduleType;
    startDate?: string;
    endDate?: string | null;
    weekdays?: string;
    categoryId?: string | null;
    notes?: string;
  };

  const title = body.title?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Vazifa matnini yozing." }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "Vazifa juda uzun." }, { status: 400 });
  }

  const scheduleType = body.scheduleType || "once";
  const startDate = normalizeDate(body.startDate ?? body.date ?? null);
  if (scheduleType === "range") {
    const end = body.endDate && isValidDateIso(body.endDate) ? body.endDate : startDate;
    if (end < startDate) {
      return NextResponse.json({ error: "Tugash sanasi noto‘g‘ri." }, { status: 400 });
    }
  }

  const id = await createTask(user.id, {
    title,
    scheduleType,
    startDate,
    endDate: body.endDate,
    weekdays: body.weekdays,
    categoryId: body.categoryId,
    notes: body.notes,
  });

  return NextResponse.json({ id }, { status: 201 });
}
