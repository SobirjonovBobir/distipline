"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { todayIso } from "@/lib/dates";

type CashCat = { id: string; name: string; color: string; kind: string };

type Tx = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  occurredOn: string;
};
type Budget = {
  id: string;
  category: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  percent: number;
};
type Saving = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  percent: number;
};
type Summary = {
  balance: number;
  incomeMonth: number;
  expenseMonth: number;
  netMonth: number;
  byCategory: { category: string; amount: number }[];
  trend: { date: string; income: number; expense: number }[];
};

function money(n: number) {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function CashControl({ onFlash }: { onFlash: (msg: string) => void }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Oziq-ovqat");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [budgetCat, setBudgetCat] = useState("Oziq-ovqat");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [savingTitle, setSavingTitle] = useState("");
  const [savingTarget, setSavingTarget] = useState("");
  const [tab, setTab] = useState<"overview" | "history" | "budget" | "savings">("overview");
  const [categories, setCategories] = useState<CashCat[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, catRes] = await Promise.all([
        fetch(`/api/cash?month=${month}`),
        fetch("/api/cash/categories"),
      ]);
      if (!res.ok) {
        onFlash("Pul nazorati yuklanmadi");
        return;
      }
      const data = await res.json();
      setSummary(data.summary);
      setTxs(data.transactions ?? []);
      setBudgets(data.budgets ?? []);
      setSavings(data.savings ?? []);
      if (catRes.ok) {
        const cats = ((await catRes.json()).categories ?? []) as CashCat[];
        setCategories(cats);
        if (cats.length > 0) {
          setCategory((prev) => (cats.some((c) => c.name === prev) ? prev : cats[0].name));
          setBudgetCat((prev) => (cats.some((c) => c.name === prev) ? prev : cats[0].name));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [month, onFlash]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => {
    if (categories.length === 0) {
      return ["Oziq-ovqat", "Transport", "Uy", "Ta’lim", "Salomatlik", "Dam olish", "Maosh", "Boshqa"];
    }
    return categories
      .filter((c) => c.kind === "both" || c.kind === kind)
      .map((c) => c.name);
  }, [categories, kind]);

  const allCategoryNames = useMemo(
    () =>
      categories.length > 0
        ? categories.map((c) => c.name)
        : ["Oziq-ovqat", "Transport", "Uy", "Ta’lim", "Salomatlik", "Dam olish", "Maosh", "Boshqa"],
    [categories],
  );

  const maxTrend = useMemo(() => {
    const vals = (summary?.trend || []).flatMap((t) => [t.income, t.expense]);
    return Math.max(1, ...vals);
  }, [summary]);

  async function addTx(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transaction",
        kind,
        amount: Number(amount),
        category,
        note,
        occurredOn: date,
      }),
    });
    if (!res.ok) {
      onFlash("Tranzaksiya saqlanmadi");
      return;
    }
    setAmount("");
    setNote("");
    onFlash(kind === "income" ? "Kirim qo‘shildi" : "Chiqim qo‘shildi");
    await load();
  }

  return (
    <div className="cash-module">
      <div className="cash-tabs" role="tablist">
        {(
          [
            ["overview", "Umumiy"],
            ["history", "Tarix"],
            ["budget", "Byudjet"],
            ["savings", "Jamg‘arma"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`cash-tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="cash-month-row">
        <label>
          Oy
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {loading && !summary ? <p className="empty">Yuklanmoqda…</p> : null}

      {tab === "overview" ? (
        <>
          <div className="grid-3 cash-stats">
            <div className="card cash-stat">
              <h3>Balans</h3>
              <p className="stat-num tone-high">{money(summary?.balance ?? 0)}</p>
              <p className="muted">so‘m</p>
            </div>
            <div className="card cash-stat">
              <h3>Kirim (oy)</h3>
              <p className="stat-num tone-high">+{money(summary?.incomeMonth ?? 0)}</p>
              <p className="muted">so‘m</p>
            </div>
            <div className="card cash-stat">
              <h3>Chiqim (oy)</h3>
              <p className="stat-num tone-low">−{money(summary?.expenseMonth ?? 0)}</p>
              <p className="muted">sof: {money(summary?.netMonth ?? 0)}</p>
            </div>
          </div>

          <div className="grid-2 cash-grid">
            <form className="card" onSubmit={addTx}>
              <h3>Tezkor yozuv</h3>
              <div className="composer-actions" style={{ marginBottom: "0.55rem" }}>
                <button
                  type="button"
                  className={`btn ${kind === "expense" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setKind("expense")}
                >
                  Chiqim
                </button>
                <button
                  type="button"
                  className={`btn ${kind === "income" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setKind("income")}
                >
                  Kirim
                </button>
              </div>
              <div className="field">
                <label>Summa</label>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="field">
                <label>Kategoriya</label>
                <select
                  value={categoryOptions.includes(category) ? category : categoryOptions[0] || ""}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Sana</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Izoh</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy" />
              </div>
              <button className="btn btn-primary" type="submit">
                Saqlash
              </button>
            </form>

            <div className="card">
              <h3>14 kunlik dinamika</h3>
              {!summary?.trend?.length ? (
                <div className="empty-state">
                  <strong>Hali grafik yo‘q</strong>
                  <p>Birinchi kirim yoki chiqimni qo‘shing.</p>
                </div>
              ) : (
                <div className="cash-chart" aria-label="Pul dinamikasi">
                  {summary.trend.map((t) => (
                    <div key={t.date} className="cash-chart-col" title={t.date}>
                      <div className="cash-chart-bars">
                        <div
                          className="cash-bar income"
                          style={{ height: `${Math.round((t.income / maxTrend) * 100)}%` }}
                        />
                        <div
                          className="cash-bar expense"
                          style={{ height: `${Math.round((t.expense / maxTrend) * 100)}%` }}
                        />
                      </div>
                      <span>{Number(t.date.slice(-2))}</span>
                    </div>
                  ))}
                </div>
              )}
              {summary?.byCategory?.length ? (
                <>
                  <h3 style={{ marginTop: "1rem" }}>Chiqim kategoriyalari</h3>
                  <ul className="cash-cat-list">
                    {summary.byCategory.map((c) => (
                      <li key={c.category}>
                        <span>{c.category}</span>
                        <strong>{money(c.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {tab === "history" ? (
        <div className="card">
          <h3>Tarix</h3>
          {txs.length === 0 ? (
            <div className="empty-state">
              <strong>Tranzaksiyalar yo‘q</strong>
              <p>Umumiy bo‘limdan kirim/chiqim qo‘shing.</p>
            </div>
          ) : (
            <ul className="cash-history">
              {txs.map((t) => (
                <li key={t.id} className={`cash-tx ${t.kind}`}>
                  <div>
                    <strong>{t.category}</strong>
                    <p className="muted">
                      {t.occurredOn}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <div className="cash-tx-right">
                    <span>
                      {t.kind === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </span>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label="O‘chirish"
                      onClick={async () => {
                        await fetch(`/api/cash/${t.id}`, { method: "DELETE" });
                        onFlash("O‘chirildi");
                        await load();
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "budget" ? (
        <div className="grid-2 cash-grid">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch("/api/cash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "budget",
                  category: budgetCat,
                  monthKey: month,
                  limitAmount: Number(budgetLimit),
                }),
              });
              if (!res.ok) {
                onFlash("Byudjet saqlanmadi");
                return;
              }
              setBudgetLimit("");
              onFlash("Byudjet saqlandi");
              await load();
            }}
          >
            <h3>Oylik byudjet</h3>
            <div className="field">
              <label>Kategoriya</label>
              <select
                value={allCategoryNames.includes(budgetCat) ? budgetCat : allCategoryNames[0] || ""}
                onChange={(e) => setBudgetCat(e.target.value)}
                required
              >
                {allCategoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Limit (so‘m)</label>
              <input
                inputMode="decimal"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Saqlash
            </button>
          </form>
          <div className="card">
            <h3>{month} limitlari</h3>
            {budgets.length === 0 ? (
              <div className="empty-state">
                <strong>Byudjet yo‘q</strong>
                <p>Kategoriya bo‘yicha oylik limit qo‘ying.</p>
              </div>
            ) : (
              budgets.map((b) => (
                <div key={b.id} className="budget-row">
                  <div className="budget-head">
                    <strong>{b.category}</strong>
                    <span>
                      {money(b.spent)} / {money(b.limitAmount)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill tone-${b.percent >= 90 ? "low" : b.percent >= 70 ? "mid" : "high"}`}
                      style={{ width: `${b.percent}%` }}
                    />
                  </div>
                  <p className="muted">Qoldiq: {money(b.remaining)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "savings" ? (
        <div className="grid-2 cash-grid">
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch("/api/cash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "saving",
                  title: savingTitle,
                  targetAmount: Number(savingTarget),
                }),
              });
              if (!res.ok) {
                onFlash("Jamg‘arma saqlanmadi");
                return;
              }
              setSavingTitle("");
              setSavingTarget("");
              onFlash("Jamg‘arma qo‘shildi");
              await load();
            }}
          >
            <h3>Yangi jamg‘arma</h3>
            <div className="field">
              <label>Nomi</label>
              <input
                value={savingTitle}
                onChange={(e) => setSavingTitle(e.target.value)}
                placeholder="Masalan: Telefon"
                required
              />
            </div>
            <div className="field">
              <label>Maqsad (so‘m)</label>
              <input
                inputMode="decimal"
                value={savingTarget}
                onChange={(e) => setSavingTarget(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Qo‘shish
            </button>
          </form>
          <div className="card">
            <h3>Maqsadlar</h3>
            {savings.length === 0 ? (
              <div className="empty-state">
                <strong>Jamg‘arma yo‘q</strong>
                <p>Birinchi maqsadingizni qo‘ying.</p>
              </div>
            ) : (
              savings.map((s) => (
                <div key={s.id} className="budget-row">
                  <div className="budget-head">
                    <strong>{s.title}</strong>
                    <span>
                      {money(s.currentAmount)} / {money(s.targetAmount)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill tone-high" style={{ width: `${s.percent}%` }} />
                  </div>
                  <div className="composer-actions" style={{ marginTop: "0.45rem" }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={async () => {
                        const add = Number(prompt("Qo‘shiladigan summa", "100000") || "0");
                        if (!add) return;
                        await fetch(`/api/cash/${s.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type: "saving",
                            currentAmount: s.currentAmount + add,
                          }),
                        });
                        await load();
                      }}
                    >
                      + summa
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/cash/${s.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "saving", archived: true }),
                        });
                        await load();
                      }}
                    >
                      Arxiv
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
