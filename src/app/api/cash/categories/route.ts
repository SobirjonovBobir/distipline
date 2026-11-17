import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createCashCategory,
  listCashCategories,
} from "@/lib/cash-categories";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  try {
    const categories = await listCashCategories(user.id);
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Yuklanmadi" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as { name?: string; color?: string; kind?: string };
  try {
    const category = await createCashCategory(user.id, {
      name: body.name || "",
      color: body.color,
      kind: body.kind,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saqlanmadi" },
      { status: 400 },
    );
  }
}
