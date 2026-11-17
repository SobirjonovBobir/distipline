import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isValidDateIso, todayIso } from "@/lib/dates";
import type { ScheduleType } from "@/lib/schedule";
import { deleteTask, setOccurrenceDone, updateTask } from "@/lib/tasks";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    done?: boolean;
    date?: string;
    title?: string;
    scheduleType?: ScheduleType;
    startDate?: string;
    endDate?: string | null;
    weekdays?: string;
    categoryId?: string | null;
    notes?: string;
    archived?: boolean;
  };

  if (typeof body.done === "boolean") {
    const date = body.date && isValidDateIso(body.date) ? body.date : todayIso();
    await setOccurrenceDone(user.id, id, date, body.done);
    return NextResponse.json({ ok: true });
  }

  const ok = await updateTask(user.id, id, {
    title: body.title,
    scheduleType: body.scheduleType,
    startDate: body.startDate,
    endDate: body.endDate,
    weekdays: body.weekdays,
    categoryId: body.categoryId,
    notes: body.notes,
    archived: body.archived,
  });
  if (!ok) {
    return NextResponse.json({ error: "Vazifa topilmadi." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteTask(user.id, id);
  return NextResponse.json({ ok: true });
}
