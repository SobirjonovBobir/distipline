import { NextResponse } from "next/server";
import {
  createSession,
  findUserByEmail,
  toSessionUser,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return NextResponse.json(
        { error: "Email yoki parol noto‘g‘ri." },
        { status: 401 },
      );
    }

    const user = toSessionUser(row);
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Kirishda xatolik." }, { status: 500 });
  }
}
