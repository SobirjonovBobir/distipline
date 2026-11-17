import { NextResponse } from "next/server";
import { updatePasswordByEmail } from "@/lib/auth";

const GENERIC_OK =
  "Agar bu email ro‘yxatdan o‘tgan bo‘lsa, parol yangilandi. Endi kirishingiz mumkin.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      confirmPassword?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email manzili noto‘g‘ri." }, { status: 400 });
    }
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

    // Local/dev: no email token — update bcrypt hash when the account exists.
    // Always return the same message so responses do not leak existence.
    await updatePasswordByEmail(email, password);
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  } catch (error) {
    console.error("reset-password failed", error);
    return NextResponse.json(
      { error: "Parolni tiklashda xatolik." },
      { status: 500 },
    );
  }
}
