import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSettings, updateSettings, type UserSettings } from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  return NextResponse.json({ settings: await getSettings(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as Partial<UserSettings>;
  const settings = await updateSettings(user.id, body);
  return NextResponse.json({ settings });
}
