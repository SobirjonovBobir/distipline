import { NextResponse } from "next/server";
import {
  clearSession,
  createSession,
  findUserById,
  getSessionUser,
  toSessionUser,
  updatePasswordForUser,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
    }

    const body = (await request.json()) as {
      currentPassword?: string;
      password?: string;
      confirmPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Parol kamida 6 belgidan iborat bo‘lsin." },
        { status: 400 },
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Parollar mos kelmadi." },
        { status: 400 },
      );
    }

    const row = await findUserById(session.id);
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      return NextResponse.json(
        { error: "Joriy parol noto‘g‘ri." },
        { status: 401 },
      );
    }

    const updated = await updatePasswordForUser(session.id, password);
    if (!updated) {
      return NextResponse.json({ error: "Parolni yangilab bo‘lmadi." }, { status: 500 });
    }

    // Invalidate the old session cookie, then issue a fresh one.
    await clearSession();
    await createSession(toSessionUser(row));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("change-password failed", error);
    return NextResponse.json(
      { error: "Parolni o‘zgartirishda xatolik." },
      { status: 500 },
    );
  }
}
