import { addDaysIso, todayIso } from "./dates";
import { computeStreak, loadDefs, summarizeRange } from "./stats-core";
import { sql } from "./db";

export type InsightItem = { id: string; title: string; body: string; tone: string };

export async function buildInsights(userId: string) {
  const today = todayIso();
  const weekFrom = addDaysIso(today, -6);
  const defs = await loadDefs(userId);
  const week = await summarizeRange(userId, weekFrom, today, defs);
  const streak = await computeStreak(userId, today);
  const focus = await sql<{ total: number | string; sessions: number | string }>(
    `select coalesce(sum(elapsed_seconds),0) as total, count(*)::int as sessions
     from focus_sessions
     where user_id = $1 and started_at::date >= $2::date`,
    [userId, weekFrom],
  );
  const journalCount = await sql<{ c: number | string }>(
    `select count(*)::int as c from journal_entries
     where user_id = $1 and entry_date >= $2`,
    [userId, weekFrom],
  );
  const cashMonth = await sql<{
    income: number | string;
    expense: number | string;
    tx: number | string;
  }>(
    `select
       coalesce(sum(case when kind = 'income' then amount else 0 end),0) as income,
       coalesce(sum(case when kind = 'expense' then amount else 0 end),0) as expense,
       count(*)::int as tx
     from cash_transactions
     where user_id = $1
       and occurred_on >= date_trunc('month', $2::date)::date
       and occurred_on < (date_trunc('month', $2::date) + interval '1 month')::date`,
    [userId, today],
  );

  const insights: InsightItem[] = [];
  const focusSeconds = Number(focus[0]?.total ?? 0);
  const focusSessions = Number(focus[0]?.sessions ?? 0);
  const journals = Number(journalCount[0]?.c ?? 0);
  const cashTx = Number(cashMonth[0]?.tx ?? 0);
  const cashExpense = Number(cashMonth[0]?.expense ?? 0);
  const cashIncome = Number(cashMonth[0]?.income ?? 0);

  const hasData = week.total > 0 || focusSessions > 0 || journals > 0 || cashTx > 0 || streak > 0;
  if (!hasData) {
    return {
      week,
      streak,
      focusSeconds,
      focusSessions,
      journals,
      hasData: false,
      hero: null as InsightItem | null,
      insights: [] as InsightItem[],
    };
  }

  if ((week.percent ?? 0) >= 80 && week.total > 0) {
    insights.push({
      id: "strong-week",
      title: "Kuchli hafta",
      body: `So‘nggi 7 kunda ${week.label} bajarildi (${week.completed}/${week.total}). Sur’atni saqlang.`,
      tone: "high",
    });
  } else if (week.total > 0 && (week.percent ?? 0) < 50) {
    insights.push({
      id: "low-week",
      title: "Diqqat kerak",
      body: `Haftalik bajarilish ${week.label}. Eng oson 1 vazifani bugun yoping.`,
      tone: "low",
    });
  } else if (week.total > 0) {
    insights.push({
      id: "steady-week",
      title: "Barqaror harakat",
      body: `Hafta: ${week.label} (${week.completed}/${week.total}). Kichik g‘alabalar yig‘iladi.`,
      tone: "mid",
    });
  }

  if (streak >= 3) {
    insights.push({
      id: "streak",
      title: `${streak} kunlik zanjir`,
      body: "Mukammal kunlar ketma-ketligi davom etmoqda. Bugunni ham 100% qiling.",
      tone: "high",
    });
  } else if (streak === 0 && week.total > 0) {
    insights.push({
      id: "restart-streak",
      title: "Zanjirni qayta boshlang",
      body: "Bugungi barcha vazifalarni yopsangiz, yangi streak ochiladi.",
      tone: "mid",
    });
  }

  if (focusSessions === 0) {
    insights.push({
      id: "try-focus",
      title: "Focus Mode sinab ko‘ring",
      body: "25 daqiqalik Pomodoro sessiyasi e’tiborni yig‘adi. Natija Statistika’da saqlanadi.",
      tone: "neutral",
    });
  } else {
    const mins = Math.round(focusSeconds / 60);
    insights.push({
      id: "focus-week",
      title: "Fokus vaqti",
      body: `Bu hafta ${focusSessions} ta sessiya · ${mins} daqiqa. Baraka topgur.`,
      tone: "high",
    });
  }

  if (journals === 0) {
    insights.push({
      id: "journal",
      title: "Kundalik yozing",
      body: "Bugungi kayfiyat va minnatdorchilikni qisqa yozib qo‘ying — odat mustahkamlanadi.",
      tone: "neutral",
    });
  } else {
    insights.push({
      id: "journal-ok",
      title: "Kundalik odat",
      body: `So‘nggi 7 kunda ${journals} ta yozuv. Davom eting — o‘zini kuzatish kuchayadi.`,
      tone: "high",
    });
  }

  const lowDays = week.trend.filter((d) => d.total > 0 && (d.percent ?? 0) < 50).length;
  if (lowDays >= 3) {
    insights.push({
      id: "missed-pattern",
      title: "O‘tkazib yuborishlar ko‘p",
      body: `${lowDays} kunda past foiz bo‘lgan. Vazifalarni kamaytiring yoki qayta rejalashtiring.`,
      tone: "low",
    });
  }

  if (cashTx > 0) {
    const net = cashIncome - cashExpense;
    insights.push({
      id: "cash-month",
      title: "Pul nazorati",
      body:
        net >= 0
          ? `Bu oy sof +${Math.round(net).toLocaleString("uz-UZ")} so‘m (${cashTx} yozuv). Byudjetni saqlang.`
          : `Bu oy chiqim kirimdan ko‘p (${Math.round(Math.abs(net)).toLocaleString("uz-UZ")} so‘m). Kategoriyalarni ko‘rib chiqing.`,
      tone: net >= 0 ? "high" : "low",
    });
  } else {
    insights.push({
      id: "try-cash",
      title: "Pul yozuvini boshlang",
      body: "Birinchi kirim yoki chiqimni qo‘shing — oy oxirida aniq rasm chiqadi.",
      tone: "neutral",
    });
  }

  const capped = insights.slice(0, 5);
  return {
    week,
    streak,
    focusSeconds,
    focusSessions,
    journals,
    hasData: true,
    hero: capped[0] ?? null,
    insights: capped,
  };
}
