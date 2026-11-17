import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { isValidDateIso, todayIso } from "@/lib/dates";
import { calendarMonth } from "@/lib/tasks";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  await ensureDefaultCategories(user.id);
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const anchor =
    month && /^\d{4}-\d{2}$/.test(month)
      ? `${month}-01`
      : month && isValidDateIso(month)
        ? month
        : todayIso();
  const days = await calendarMonth(user.id, anchor);
  return NextResponse.json({ month: anchor.slice(0, 7), days });
}
