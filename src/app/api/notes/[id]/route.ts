import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  }
  const { id } = await context.params;
  await sql("delete from notes where id = $1 and user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
