import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildInsights } from "@/lib/insights";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const data = await buildInsights(user.id);
  return NextResponse.json(data);
}
