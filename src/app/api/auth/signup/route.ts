import { NextResponse } from "next/server";
import { createSession, createUser, findUserByEmail } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { allowRequest, clientKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    if (!allowRequest(clientKey(request, "signup"), { limit: 10, windowMs: 15 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const displayName = body.displayName?.trim() || email.split("@")[0] || "Foydalanuvchi";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email manzili noto‘g‘ri." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Parol kamida 6 belgidan iborat bo‘lsin." },
        { status: 400 },
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Bu email allaqachon ro‘yxatdan o‘tgan." },
        { status: 409 },
      );
    }

    const user = await createUser({ email, password, displayName });
    await ensureDefaultCategories(user.id);
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("signup failed", error);
    return NextResponse.json({ error: "Ro‘yxatdan o‘tishda xatolik." }, { status: 500 });
  }
}
