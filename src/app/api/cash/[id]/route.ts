import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteCashTransaction, patchSaving } from "@/lib/cash";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    type?: "saving" | "transaction";
    currentAmount?: number;
    archived?: boolean;
    title?: string;
  };
  if (body.type === "saving") {
    await patchSaving(user.id, id, body);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Noma’lum so‘rov" }, { status: 400 });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const { id } = await ctx.params;
  await deleteCashTransaction(user.id, id);
  return NextResponse.json({ ok: true });
}
