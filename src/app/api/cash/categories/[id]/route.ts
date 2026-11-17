import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteCashCategory, updateCashCategory } from "@/lib/cash-categories";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json()) as { name?: string; color?: string; kind?: string };
  try {
    const category = await updateCashCategory(user.id, id, body);
    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Yangilanmadi" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await context.params;
  try {
    await deleteCashCategory(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "O‘chirilmadi" },
      { status: 400 },
    );
  }
}
