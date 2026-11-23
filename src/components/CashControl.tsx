"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { todayIso } from "@/lib/dates";
import { formatAmountInput, parseAmountInput } from "@/lib/money-input";
import { isPersonalCategoryName, PERSONAL_CATEGORY_NAME, privacyText } from "@/lib/personal";

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

type Props = {
  onFlash: (msg: string) => void;
  /** "normal" hides Shaxsiy items from lists; "personal" shows only Shaxsiy. Totals stay full. */
  listMode?: "normal" | "personal";
  /** Mask sensitive text (titles, notes, amounts) in list UIs. */
  maskSensitive?: boolean;
  /** Compact layout for embedding inside Shaxsiy section. */
  compact?: boolean;
};

export function CashControl({
  onFlash,
  listMode = "normal",
  maskSensitive = false,
  compact = false,
}: Props) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(
    listMode === "personal" ? PERSONAL_CATEGORY_NAME : "Oziq-ovqat",
  );
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [budgetCat, setBudgetCat] = useState("Oziq-ovqat");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [savingTitle, setSavingTitle] = useState("");
  const [savingTarget, setSavingTarget] = useState("");
  const [tab, setTab] = useState<"overview" | "history" | "budget" | "savings">(
    listMode === "personal" ? "history" : "overview",
  );
  const [categories, setCategories] = useState<CashCat[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyKind, setHistoryKind] = useState<"" | "income" | "expense">("");

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
        if (listMode === "personal") {
          setCategory(PERSONAL_CATEGORY_NAME);
        } else if (cats.length > 0) {
          setCategory((prev) =>
            isPersonalCategoryName(prev)
              ? cats.find((c) => !isPersonalCategoryName(c.name))?.name || cats[0].name
              : cats.some((c) => c.name === prev)
                ? prev
                : cats.find((c) => !isPersonalCategoryName(c.name))?.name || cats[0].name,
          );
          setBudgetCat((prev) =>
            isPersonalCategoryName(prev)
              ? cats.find((c) => !isPersonalCategoryName(c.name))?.name || cats[0].name
              : cats.some((c) => c.name === prev)
                ? prev
                : cats.find((c) => !isPersonalCategoryName(c.name))?.name || cats[0].name,
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [month, onFlash, listMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => {
    if (listMode === "personal") return [PERSONAL_CATEGORY_NAME];
    const base =
      categories.length === 0
        ? ["Oziq-ovqat", "Transport", "Uy", "Ta’lim", "Salomatlik", "Dam olish", "Maosh", "Boshqa"]
        : categories
            .filter((c) => c.kind === "both" || c.kind === kind)
            .map((c) => c.name);
    return base.filter((name) => !isPersonalCategoryName(name));
  }, [categories, kind, listMode]);

  const allCategoryNames = useMemo(() => {
    if (listMode === "personal") return [PERSONAL_CATEGORY_NAME];
    const names =
      categories.length > 0
        ? categories.map((c) => c.name)
        : ["Oziq-ovqat", "Transport", "Uy", "Ta’lim", "Salomatlik", "Dam olish", "Maosh", "Boshqa"];
    return names.filter((name) => !isPersonalCategoryName(name));
  }, [categories, listMode]);

  const visibleTxs = useMemo(() => {
    if (listMode === "personal") return txs.filter((t) => isPersonalCategoryName(t.category));
    return txs.filter((t) => !isPersonalCategoryName(t.category));
  }, [txs, listMode]);

  const visibleBudgets = useMemo(() => {
    if (listMode === "personal") return budgets.filter((b) => isPersonalCategoryName(b.category));
    return budgets.filter((b) => !isPersonalCategoryName(b.category));
  }, [budgets, listMode]);

  const visibleByCategory = useMemo(() => {
    const list = summary?.byCategory || [];
    if (listMode === "personal") return list.filter((c) => isPersonalCategoryName(c.category));
    return list.filter((c) => !isPersonalCategoryName(c.category));
  }, [summary, listMode]);

  const maxTrend = useMemo(() => {
    const vals = (summary?.trend || []).flatMap((t) => [t.income, t.expense]);
    return Math.max(1, ...vals);
  }, [summary]);

  const filteredTxs = useMemo(() => {
    let list = [...visibleTxs];
    if (historyKind) list = list.filter((t) => t.kind === historyKind);
    if (historyQuery.trim()) {
      const q = historyQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          t.note.toLowerCase().includes(q) ||
          t.occurredOn.includes(q),
      );
    }
    return list;
  }, [visibleTxs, historyKind, historyQuery]);

  function displayAmount(n: number) {
    return maskSensitive ? privacyText(money(n), true) : money(n);
  }

  function displayNote(text: string) {
    return maskSensitive ? privacyText(text, true, "········") : text;
  }

  async function addTx(e: FormEvent) {
    e.preventDefault();
    const cat = listMode === "personal" ? PERSONAL_CATEGORY_NAME : category;
    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transaction",
        kind,
        amount: parseAmountInput(amount),
        category: cat,
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

  function onAmountChange(value: string) {
    setAmount(formatAmountInput(value));
  }

  function onBudgetLimitChange(value: string) {
    setBudgetLimit(formatAmountInput(value));
  }

  function onSavingTargetChange(value: string) {
    setSavingTarget(formatAmountInput(value));
  }

  const showTabs = !compact;
  const showOverview = !compact && tab === "overview";
  const showHistory = compact || tab === "history";
  const showBudget = !compact && tab === "budget";
  const showSavings = !compact && tab === "savings";

  return (
    <div className={`cash-module${compact ? " cash-compact" : ""}`}>
      {showTabs ? (
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
      ) : null}

      <div className="cash-month-row">
        <label>
          Oy
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {loading && !summary ? <p className="empty">Yuklanmoqda…</p> : null}

      {showOverview ? (
        <>
          <div className="grid-3 cash-stats">
            <div className="card cash-stat">
              <h3>Balans</h3>
              <p className="stat-num tone-high">{money(summary?.balance ?? 0)}</p>
              <p className="muted">so‘m · jami (shaxsiy bilan)</p>
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
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="0"
                  required
                  autoComplete="off"
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
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem" }}>
                  Shaxsiy yozuvlar → Shaxsiy bo‘limi
                </p>
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
              {visibleByCategory.length ? (
                <>
                  <h3 style={{ marginTop: "1rem" }}>Chiqim kategoriyalari</h3>
                  <ul className="cash-cat-list">
                    {visibleByCategory.map((c) => (
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

      {showHistory ? (
        <div className="card">
          <h3>
            {listMode === "personal" ? "Shaxsiy tarix" : "Tarix"} · {month}
          </h3>
          {compact ? (
            <form onSubmit={addTx} className="personal-cash-form">
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
              <div className="filters journal-filters" style={{ marginBottom: "0.65rem" }}>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="Summa"
                  required
                  aria-label="Summa"
                  autoComplete="off"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Izoh"
                  aria-label="Izoh"
                />
                <button className="btn btn-primary" type="submit">
                  Qo‘shish
                </button>
              </div>
            </form>
          ) : null}
          <div className="filters journal-filters" style={{ marginBottom: "0.65rem" }}>
            <input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Qidiruv…"
              aria-label="Tranzaksiya qidiruv"
            />
            <select
              value={historyKind}
              onChange={(e) => setHistoryKind(e.target.value as typeof historyKind)}
              aria-label="Tur filtri"
            >
              <option value="">Hammasi</option>
              <option value="income">Kirim</option>
              <option value="expense">Chiqim</option>
            </select>
          </div>
          {visibleTxs.length === 0 ? (
            <div className="empty-state">
              <strong>Tranzaksiyalar yo‘q</strong>
              <p>
                {listMode === "personal"
                  ? "Shaxsiy kirim/chiqim qo‘shing."
                  : "Umumiy bo‘limdan kirim/chiqim qo‘shing."}
              </p>
            </div>
          ) : filteredTxs.length === 0 ? (
            <div className="empty-state compact">
              <strong>Mos yozuv yo‘q</strong>
              <p>Qidiruv yoki filterni o‘zgartiring.</p>
            </div>
          ) : (
            <ul className="cash-history">
              {filteredTxs.map((t) => (
                <li key={t.id} className={`cash-tx ${t.kind}`}>
                  <div>
                    <strong className={maskSensitive ? "privacy-mask" : undefined}>
                      {maskSensitive ? privacyText(t.category, true) : t.category}
                    </strong>
                    <p className={`muted${maskSensitive ? " privacy-mask" : ""}`}>
                      {t.occurredOn}
                      {t.note ? ` · ${displayNote(t.note)}` : ""}
                    </p>
                  </div>
                  <div className="cash-tx-right">
                    <span className={maskSensitive ? "privacy-mask" : undefined}>
                      {t.kind === "income" ? "+" : "−"}
                      {displayAmount(t.amount)}
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

      {showBudget ? (
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
                  limitAmount: parseAmountInput(budgetLimit),
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
                onChange={(e) => onBudgetLimitChange(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Saqlash
            </button>
          </form>
          <div className="card">
            <h3>{month} limitlari</h3>
            {visibleBudgets.length === 0 ? (
              <div className="empty-state">
                <strong>Byudjet yo‘q</strong>
                <p>Kategoriya bo‘yicha oylik limit qo‘ying.</p>
              </div>
            ) : (
              visibleBudgets.map((b) => (
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

      {showSavings ? (
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
                  targetAmount: parseAmountInput(savingTarget),
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
                onChange={(e) => onSavingTargetChange(e.target.value)}
                required
                autoComplete="off"
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
                        const add = parseAmountInput(
                          prompt("Qo‘shiladigan summa", "100 000") || "0",
                        );
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
