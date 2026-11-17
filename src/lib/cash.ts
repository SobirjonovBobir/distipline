import { sql } from "./db";
import { todayIso } from "./dates";

export type CashAccount = {
  id: string;
  name: string;
  currency: string;
  openingBalance: number;
};

export type CashTransaction = {
  id: string;
  accountId: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  occurredOn: string;
  createdAt: string;
};

export type CashBudget = {
  id: string;
  category: string;
  monthKey: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  percent: number;
};

export type CashSaving = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  note: string;
  percent: number;
};

export type CashSummary = {
  balance: number;
  incomeMonth: number;
  expenseMonth: number;
  netMonth: number;
  byCategory: { category: string; amount: number }[];
  trend: { date: string; income: number; expense: number }[];
};

function num(v: unknown) {
  return Number(v) || 0;
}

async function ensureAccount(userId: string): Promise<CashAccount> {
  const rows = await sql<{
    id: string;
    name: string;
    currency: string;
    opening_balance: number | string;
  }>(
    `select id, name, currency, opening_balance
     from cash_accounts
     where user_id = $1 and archived = false
     order by created_at asc
     limit 1`,
    [userId],
  );
  if (rows[0]) {
    return {
      id: rows[0].id,
      name: rows[0].name,
      currency: rows[0].currency,
      openingBalance: num(rows[0].opening_balance),
    };
  }
  const id = crypto.randomUUID();
  await sql(
    `insert into cash_accounts (id, user_id, name, currency, opening_balance)
     values ($1,$2,'Asosiy','UZS',0)`,
    [id, userId],
  );
  return { id, name: "Asosiy", currency: "UZS", openingBalance: 0 };
}

export async function getCashDashboard(userId: string, monthKey?: string) {
  const account = await ensureAccount(userId);
  const month = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : todayIso().slice(0, 7);
  const monthStart = `${month}-01`;

  const [txRows, budgetRows, savingRows, trendRows] = await Promise.all([
    sql<{
      id: string;
      account_id: string;
      kind: "income" | "expense";
      amount: number | string;
      category: string;
      note: string;
      occurred_on: string;
      created_at: string;
    }>(
      `select id, account_id, kind, amount, category, note,
              occurred_on::text as occurred_on, created_at::text as created_at
       from cash_transactions
       where user_id = $1
       order by occurred_on desc, created_at desc
       limit 80`,
      [userId],
    ),
    sql<{
      id: string;
      category: string;
      month_key: string;
      limit_amount: number | string;
    }>(
      `select id, category, month_key, limit_amount
       from cash_budgets
       where user_id = $1 and month_key = $2
       order by category`,
      [userId, month],
    ),
    sql<{
      id: string;
      title: string;
      target_amount: number | string;
      current_amount: number | string;
      note: string;
    }>(
      `select id, title, target_amount, current_amount, note
       from cash_savings
       where user_id = $1 and archived = false
       order by created_at desc`,
      [userId],
    ),
    sql<{ d: string; income: number | string; expense: number | string }>(
      `select occurred_on::text as d,
              coalesce(sum(case when kind = 'income' then amount else 0 end),0) as income,
              coalesce(sum(case when kind = 'expense' then amount else 0 end),0) as expense
       from cash_transactions
       where user_id = $1 and occurred_on >= ($2::date - interval '13 days')
       group by occurred_on
       order by occurred_on`,
      [userId, todayIso()],
    ),
  ]);

  const allSums = await sql<{ income: number | string; expense: number | string }>(
    `select coalesce(sum(case when kind = 'income' then amount else 0 end),0) as income,
            coalesce(sum(case when kind = 'expense' then amount else 0 end),0) as expense
     from cash_transactions where user_id = $1`,
    [userId],
  );
  const monthSums = await sql<{ income: number | string; expense: number | string }>(
    `select coalesce(sum(case when kind = 'income' then amount else 0 end),0) as income,
            coalesce(sum(case when kind = 'expense' then amount else 0 end),0) as expense
     from cash_transactions
     where user_id = $1 and occurred_on >= $2::date and occurred_on < ($2::date + interval '1 month')`,
    [userId, monthStart],
  );
  const byCat = await sql<{ category: string; amount: number | string }>(
    `select category, coalesce(sum(amount),0) as amount
     from cash_transactions
     where user_id = $1 and kind = 'expense'
       and occurred_on >= $2::date and occurred_on < ($2::date + interval '1 month')
     group by category
     order by amount desc
     limit 8`,
    [userId, monthStart],
  );

  const incomeAll = num(allSums[0]?.income);
  const expenseAll = num(allSums[0]?.expense);
  const incomeMonth = num(monthSums[0]?.income);
  const expenseMonth = num(monthSums[0]?.expense);
  const spentByCat = new Map(
    (
      await sql<{ category: string; amount: number | string }>(
        `select category, coalesce(sum(amount),0) as amount
         from cash_transactions
         where user_id = $1 and kind = 'expense'
           and occurred_on >= $2::date and occurred_on < ($2::date + interval '1 month')
         group by category`,
        [userId, monthStart],
      )
    ).map((r) => [r.category, num(r.amount)]),
  );

  const transactions: CashTransaction[] = txRows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    kind: r.kind,
    amount: num(r.amount),
    category: r.category,
    note: r.note,
    occurredOn: String(r.occurred_on).slice(0, 10),
    createdAt: r.created_at,
  }));

  const budgets: CashBudget[] = budgetRows.map((b) => {
    const spent = spentByCat.get(b.category) ?? 0;
    const limitAmount = num(b.limit_amount);
    const remaining = Math.max(0, limitAmount - spent);
    const percent = limitAmount > 0 ? Math.min(100, Math.round((spent / limitAmount) * 100)) : 0;
    return {
      id: b.id,
      category: b.category,
      monthKey: b.month_key,
      limitAmount,
      spent,
      remaining,
      percent,
    };
  });

  const savings: CashSaving[] = savingRows.map((s) => {
    const targetAmount = num(s.target_amount);
    const currentAmount = num(s.current_amount);
    return {
      id: s.id,
      title: s.title,
      targetAmount,
      currentAmount,
      note: s.note,
      percent: targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0,
    };
  });

  const summary: CashSummary = {
    balance: account.openingBalance + incomeAll - expenseAll,
    incomeMonth,
    expenseMonth,
    netMonth: incomeMonth - expenseMonth,
    byCategory: byCat.map((c) => ({ category: c.category, amount: num(c.amount) })),
    trend: trendRows.map((t) => ({
      date: String(t.d).slice(0, 10),
      income: num(t.income),
      expense: num(t.expense),
    })),
  };

  return {
    account,
    month,
    monthStart,
    summary,
    transactions,
    budgets,
    savings,
  };
}

async function ownedAccountId(userId: string, accountId: string | undefined) {
  const fallback = await ensureAccount(userId);
  const requested = accountId?.trim();
  if (!requested || requested === fallback.id) return fallback.id;
  const rows = await sql<{ id: string }>(
    `select id from cash_accounts
     where id = $1 and user_id = $2 and archived = false
     limit 1`,
    [requested, userId],
  );
  return rows[0]?.id ?? fallback.id;
}

export async function addCashTransaction(
  userId: string,
  input: {
    kind: "income" | "expense";
    amount: number;
    category?: string;
    note?: string;
    occurredOn?: string;
    accountId?: string;
  },
) {
  const accountId = await ownedAccountId(userId, input.accountId);
  const id = crypto.randomUUID();
  const amount = Math.round(Math.abs(Number(input.amount) || 0) * 100) / 100;
  if (amount <= 0) throw new Error("Summa noto‘g‘ri");
  const kind = input.kind === "income" ? "income" : "expense";
  const occurredOn =
    input.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ? input.occurredOn : todayIso();
  await sql(
    `insert into cash_transactions (id, user_id, account_id, kind, amount, category, note, occurred_on)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      userId,
      accountId,
      kind,
      amount,
      (input.category || "Umumiy").trim() || "Umumiy",
      (input.note || "").trim(),
      occurredOn,
    ],
  );
  return id;
}

export async function deleteCashTransaction(userId: string, id: string) {
  await sql(`delete from cash_transactions where id = $1 and user_id = $2`, [id, userId]);
}

export async function upsertBudget(
  userId: string,
  input: { category: string; monthKey?: string; limitAmount: number },
) {
  const category = input.category.trim();
  if (!category) throw new Error("Kategoriya kerak");
  const monthKey =
    input.monthKey && /^\d{4}-\d{2}$/.test(input.monthKey) ? input.monthKey : todayIso().slice(0, 7);
  const limitAmount = Math.max(0, Math.round(Number(input.limitAmount) * 100) / 100);
  const id = crypto.randomUUID();
  await sql(
    `insert into cash_budgets (id, user_id, category, month_key, limit_amount)
     values ($1,$2,$3,$4,$5)
     on conflict (user_id, category, month_key)
     do update set limit_amount = excluded.limit_amount`,
    [id, userId, category, monthKey, limitAmount],
  );
}

export async function addSaving(
  userId: string,
  input: { title: string; targetAmount: number; currentAmount?: number; note?: string },
) {
  const title = input.title.trim();
  if (!title) throw new Error("Nom kerak");
  const targetAmount = Math.max(1, Number(input.targetAmount) || 0);
  const currentAmount = Math.max(0, Number(input.currentAmount) || 0);
  const id = crypto.randomUUID();
  await sql(
    `insert into cash_savings (id, user_id, title, target_amount, current_amount, note)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, userId, title, targetAmount, currentAmount, (input.note || "").trim()],
  );
  return id;
}

export async function patchSaving(
  userId: string,
  id: string,
  patch: { currentAmount?: number; archived?: boolean; title?: string },
) {
  if (patch.archived) {
    await sql(
      `update cash_savings set archived = true, updated_at = now() where id = $1 and user_id = $2`,
      [id, userId],
    );
    return;
  }
  if (typeof patch.currentAmount === "number") {
    await sql(
      `update cash_savings set current_amount = $3, updated_at = now()
       where id = $1 and user_id = $2`,
      [id, userId, Math.max(0, patch.currentAmount)],
    );
  }
  if (patch.title?.trim()) {
    await sql(
      `update cash_savings set title = $3, updated_at = now() where id = $1 and user_id = $2`,
      [id, userId, patch.title.trim()],
    );
  }
}
