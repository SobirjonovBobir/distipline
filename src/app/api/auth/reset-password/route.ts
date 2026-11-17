import { NextResponse } from "next/server";

/** Unauthenticated email-only reset is disabled (account-takeover risk). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Parolni email orqali tiklash o‘chirilgan. Kirgan holda Sozlamalar → Parol orqali o‘zgartiring.",
    },
    { status: 403 },
  );
}
