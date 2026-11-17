import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  addCashTransaction,
  addSaving,
  getCashDashboard,
  upsertBudget,
} from "@/lib/cash";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") || undefined;
  try {
    const data = await getCashDashboard(user.id, month);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cash yuklanmadi" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const body = (await request.json()) as {
    action?: "transaction" | "budget" | "saving";
    kind?: "income" | "expense";
    amount?: number;
    category?: string;
    note?: string;
    occurredOn?: string;
    monthKey?: string;
    limitAmount?: number;
    title?: string;
    targetAmount?: number;
    currentAmount?: number;
  };

  try {
    if (body.action === "budget") {
      await upsertBudget(user.id, {
        category: body.category || "",
        monthKey: body.monthKey,
        limitAmount: Number(body.limitAmount) || 0,
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (body.action === "saving") {
      const id = await addSaving(user.id, {
        title: body.title || "",
        targetAmount: Number(body.targetAmount) || 0,
        currentAmount: Number(body.currentAmount) || 0,
        note: body.note,
      });
      return NextResponse.json({ id }, { status: 201 });
    }
    const id = await addCashTransaction(user.id, {
      kind: body.kind === "income" ? "income" : "expense",
      amount: Number(body.amount) || 0,
      category: body.category,
      note: body.note,
      occurredOn: body.occurredOn,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saqlanmadi" },
      { status: 400 },
    );
  }
}
