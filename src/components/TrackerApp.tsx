"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthForm } from "./AuthForm";
import { DateNavigator } from "./DateNavigator";
import { StatsPanel } from "./StatsPanel";
import { TaskForm, type Category, type TaskDraft } from "./TaskForm";
import {
  addDaysIso,
  daysInMonthGrid,
  describeUzbekDate,
  parseIsoDate,
  todayIso,
} from "@/lib/dates";
import { scheduleLabelUz, type ScheduleType } from "@/lib/schedule";

type User = { id: string; email: string; displayName: string };
type Task = {
  id: string;
  title: string;
  notes: string;
  scheduleType: ScheduleType;
  startDate: string;
  endDate: string | null;
  weekdays: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  sortOrder: number;
  occurrenceDate: string;
  done: boolean;
};
type Reminder = { id: string; body: string; kind: string; read: boolean };
type Progress = {
  completed: number;
  total: number;
  percent: number | null;
  tone: string;
  label: string;
};
type Stats = {
  day: Progress & { daysWithTasks?: number };
  week: Progress & { daysWithTasks?: number };
  month: Progress & { daysWithTasks?: number };
  trend: { date: string; completed: number; total: number; percent: number | null; tone?: string; label?: string }[];
  trendDelta: number | null;
  streak: number;
  ranges: { week: { start: string; end: string }; month: { start: string; end: string } };
};
type CalDay = { date: string; tone: string; total: number; completed: number; percent: number | null; label: string };
type Note = { id: string; body: string; pinned: boolean };
type Achievement = { code: string; title: string; unlocked: boolean };
type View = "tasks" | "overview" | "calendar" | "stats";

const TABS: { id: View; label: string; short: string }[] = [
  { id: "tasks", label: "Vazifalar", short: "Vazifa" },
  { id: "overview", label: "Natijalar", short: "Natija" },
  { id: "calendar", label: "Kalendar", short: "Kalendar" },
  { id: "stats", label: "Statistika", short: "Stat" },
];

function emptyDraft(date: string): TaskDraft {
  return {
    title: "",
    scheduleType: "once",
    startDate: date,
    endDate: date,
    weekdays: "",
    categoryId: "",
    notes: "",
  };
}

export function TrackerApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [view, setView] = useState<View>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [progress, setProgress] = useState<Progress>({
    completed: 0,
    total: 0,
    percent: null,
    tone: "neutral",
    label: "—",
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [calDays, setCalDays] = useState<CalDay[]>([]);
  const [banner, setBanner] = useState<Reminder | null>(null);
  const [inbox, setInbox] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<"order" | "name" | "status">("order");
  const [newCatName, setNewCatName] = useState("");

  const today = todayIso();
  const isToday = selectedDate === today;
  const dateInfo = describeUzbekDate(selectedDate);

  const loadReminders = useCallback(async () => {
    const res = await fetch("/api/reminders");
    if (!res.ok) return;
    const data = await res.json();
    setInbox(data.reminders ?? []);
  }, []);

  const loadNotes = useCallback(async () => {
    const res = await fetch("/api/notes");
    if (!res.ok) return;
    const data = await res.json();
    setNotes(data.notes ?? []);
  }, []);

  const loadAchievements = useCallback(async () => {
    const res = await fetch("/api/achievements");
    if (!res.ok) return;
    const data = await res.json();
    setAchievements(data.catalog ?? []);
  }, []);

  const loadStats = useCallback(async (date: string) => {
    const res = await fetch(`/api/stats?date=${encodeURIComponent(date)}`);
    if (!res.ok) return;
    const data = await res.json();
    setStats(data);
    await loadAchievements();
  }, [loadAchievements]);

  const loadCalendar = useCallback(async (date: string) => {
    const res = await fetch(`/api/calendar?month=${encodeURIComponent(date.slice(0, 7))}`);
    if (!res.ok) return;
    const data = await res.json();
    setCalDays(data.days ?? []);
  }, []);

  const loadTasks = useCallback(
    async (date: string, opts?: { remind?: boolean }) => {
      const qs = new URLSearchParams({ date });
      if (opts?.remind && date === todayIso()) qs.set("remind", "1");
      const res = await fetch(`/api/tasks?${qs.toString()}`);
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setCategories(data.categories ?? []);
      setProgress(
        data.progress ?? { completed: 0, total: 0, percent: null, tone: "neutral", label: "—" },
      );
      if (data.reminder) {
        setBanner(data.reminder);
        setToast(data.reminder.body);
        window.setTimeout(() => setToast(""), 4200);
        await loadReminders();
      }
      await Promise.all([loadStats(date), loadCalendar(date)]);
    },
    [loadCalendar, loadReminders, loadStats],
  );

  const bootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      const date = todayIso();
      setSelectedDate(date);
      await loadTasks(date, { remind: true });
      await loadReminders();
      await loadNotes();
    } finally {
      setReady(true);
    }
  }, [loadNotes, loadReminders, loadTasks]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!user || !ready) return;
    void loadTasks(selectedDate, { remind: selectedDate === todayIso() });
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      if (selectedDate === todayIso()) void loadTasks(selectedDate, { remind: true });
    }, 15 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadTasks(selectedDate, { remind: selectedDate === todayIso() });
        void loadReminders();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, selectedDate, loadTasks, loadReminders]);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q),
      );
    }
    if (categoryFilter) list = list.filter((t) => t.categoryId === categoryFilter);
    if (sortMode === "name") list.sort((a, b) => a.title.localeCompare(b.title, "uz"));
    if (sortMode === "status") list.sort((a, b) => Number(a.done) - Number(b.done));
    return list;
  }, [tasks, query, categoryFilter, sortMode]);

  async function createFromDraft(draft: TaskDraft) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        scheduleType: draft.scheduleType,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
        weekdays: draft.weekdays,
        categoryId: draft.categoryId || null,
        notes: draft.notes,
      }),
    });
    if (!res.ok) return;
    setShowCreate(false);
    await loadTasks(selectedDate);
  }

  async function saveEdit(draft: TaskDraft) {
    if (!editing) return;
    const res = await fetch(`/api/tasks/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        scheduleType: draft.scheduleType,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
        weekdays: draft.weekdays,
        categoryId: draft.categoryId || null,
        notes: draft.notes,
      }),
    });
    if (!res.ok) return;
    setEditing(null);
    await loadTasks(selectedDate);
  }

  async function toggleTask(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done, date: selectedDate }),
    });
    if (!res.ok) await loadTasks(selectedDate);
    else await loadTasks(selectedDate);
  }

  async function removeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadTasks(selectedDate);
  }

  async function rescheduleTask(task: Task, toDate: string) {
    // Preserve history: keep completions; shift one-time start, or set end and create once clone for overdue catch-up
    if (task.scheduleType === "once") {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: toDate, endDate: toDate }),
      });
    } else {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${task.title} (ko‘chirildi)`,
          scheduleType: "once",
          startDate: toDate,
          endDate: toDate,
          categoryId: task.categoryId,
          notes: task.notes || `Asl sana: ${task.occurrenceDate}`,
        }),
      });
    }
    setSelectedDate(toDate);
    await loadTasks(toDate);
    setToast("Vazifa qayta rejalashtirildi");
    window.setTimeout(() => setToast(""), 2500);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName("");
    await loadTasks(selectedDate);
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    await loadTasks(selectedDate);
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody.trim() }),
    });
    setNoteBody("");
    await loadNotes();
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    await loadNotes();
  }

  async function dismissBanner() {
    if (banner) {
      await fetch("/api/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: banner.id }),
      });
    }
    setBanner(null);
    await loadReminders();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setTasks([]);
    setInbox([]);
    setBanner(null);
    setStats(null);
  }

  function renderTask(task: Task, opts?: { overdue?: boolean }) {
    return (
      <li key={`${task.id}-${task.occurrenceDate}`} className={`task-item${task.done ? " done" : ""}${opts?.overdue ? " overdue" : ""}`}>
        <button
          className="check"
          type="button"
          aria-label={task.done ? "Bajarilmagan qilish" : "Bajarildi deb belgilash"}
          onClick={() => void toggleTask(task)}
        >
          ✓
        </button>
        <div>
          <p className="task-title">{task.title}</p>
          <div className="task-meta">
            <span className="meta-pill">{scheduleLabelUz({
              id: task.id,
              title: task.title,
              schedule_type: task.scheduleType,
              start_date: task.startDate,
              end_date: task.endDate,
              weekdays: task.weekdays,
              category_id: task.categoryId,
              notes: task.notes,
              archived: false,
              sort_order: task.sortOrder,
            })}</span>
            {task.categoryName ? (
              <span className="meta-pill">
                <span className="cat-dot" style={{ background: task.categoryColor || "#2f7a55" }} />
                {task.categoryName}
              </span>
            ) : null}
            {task.notes ? (
              <span className="meta-pill">
                {task.notes.length > 48 ? `${task.notes.slice(0, 48)}…` : task.notes}
              </span>
            ) : null}
          </div>
          <div className="row-actions" style={{ marginTop: "0.45rem" }}>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(task)}>
              Tahrirlash
            </button>
            {opts?.overdue ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void rescheduleTask(task, today)}
              >
                Bugunga ko‘chir
              </button>
            ) : null}
            {!opts?.overdue && selectedDate < today && !task.done ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void rescheduleTask(task, addDaysIso(selectedDate, 1))}
              >
                Ertaga
              </button>
            ) : null}
          </div>
        </div>
        <button className="icon-btn delete-task" type="button" aria-label="O‘chirish" onClick={() => void removeTask(task.id)}>
          ×
        </button>
      </li>
    );
  }

  if (!ready) {
    return (
      <div className="app-shell">
        <p className="empty">Yuklanmoqda…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={() => void bootstrap()} />;
  }

  const greeting = user.displayName || user.email.split("@")[0];
  const tone = progress.tone || "neutral";

  return (
    <div className="app-shell">
      <div className="top-bar">
        <span className="user-chip">Salom, {greeting}</span>
        <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
          Chiqish
        </button>
      </div>

      <div className="view-switch" role="tablist" aria-label="Bo‘limlar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={`view-tab${view === tab.id ? " active" : ""}`}
            onClick={() => setView(tab.id)}
          >
            <span className="tab-full">{tab.label}</span>
            <span className="tab-short">{tab.short}</span>
          </button>
        ))}
      </div>

      <header className="brand-lockup">
        <h1 className="brand-name">Distipline</h1>
        <p className="brand-tag">
          {isToday ? "Bugungi intizom — aniq foiz, tinch fokusish." : `${dateInfo.shortLabel} uchun intizom.`}
        </p>
      </header>

      {(view === "tasks" || view === "overview" || view === "stats") && (
        <DateNavigator date={selectedDate} onChange={setSelectedDate} dayMeta={calDays} />
      )}

      {view === "tasks" ? (
        <>
          <section className="progress-hero" aria-live="polite">
            <div className="progress-row">
              <p className="progress-label">
                {progress.completed}/{progress.total} bajarildi · {dateInfo.shortLabel}
              </p>
              <p className={`progress-value tone-${tone}`}>{progress.label}</p>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div
                className={`progress-fill tone-${tone}`}
                style={{ width: `${progress.percent ?? 0}%` }}
              />
            </div>
          </section>

          {banner && isToday ? (
            <div className="banner" role="status">
              <p>{banner.body}</p>
              <div className="banner-actions">
                <button className="btn btn-amber" type="button" onClick={() => void dismissBanner()}>
                  Tushunarli
                </button>
              </div>
            </div>
          ) : null}

          <div className="filters">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidiruv…"
              aria-label="Qidiruv"
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Barcha kategoriyalar</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
              <option value="order">Tartib</option>
              <option value="name">Nom</option>
              <option value="status">Holat</option>
            </select>
          </div>

          {!showCreate && !editing ? (
            <div className="composer-actions" style={{ marginBottom: "0.85rem" }}>
              <button className="btn btn-primary" type="button" onClick={() => setShowCreate(true)}>
                Yangi vazifa
              </button>
            </div>
          ) : null}

          {showCreate ? (
            <TaskForm
              initial={emptyDraft(selectedDate)}
              categories={categories}
              submitLabel="Qo‘shish"
              onSubmit={createFromDraft}
              onCancel={() => setShowCreate(false)}
            />
          ) : null}

          {editing ? (
            <TaskForm
              initial={{
                title: editing.title,
                scheduleType: editing.scheduleType,
                startDate: editing.startDate,
                endDate: editing.endDate || editing.startDate,
                weekdays: editing.weekdays,
                categoryId: editing.categoryId || "",
                notes: editing.notes,
              }}
              categories={categories}
              submitLabel="Saqlash"
              onSubmit={saveEdit}
              onCancel={() => setEditing(null)}
            />
          ) : null}

          {(() => {
            const open = filtered.filter((t) => !t.done);
            const done = filtered.filter((t) => t.done);
            const openTitle =
              selectedDate < today
                ? "O‘tkazib yuborilgan"
                : selectedDate > today
                  ? "Rejalashtirilgan"
                  : "Bugun";
            return (
              <>
                <h3 className="section-title">{openTitle}</h3>
                {open.length === 0 ? (
                  <p className="empty">Bu kunda ochiq vazifa yo‘q.</p>
                ) : (
                  <ul className="task-list">
                    {open.map((t) => renderTask(t, { overdue: selectedDate < today }))}
                  </ul>
                )}
                {done.length > 0 ? (
                  <>
                    <h3 className="section-title">Bajarilgan</h3>
                    <ul className="task-list">{done.map((t) => renderTask(t))}</ul>
                  </>
                ) : null}
              </>
            );
          })()}

          <section className="panel-card" style={{ marginTop: "1.2rem" }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Kategoriyalar
            </h3>
            <div className="task-meta" style={{ marginBottom: "0.65rem" }}>
              {categories.map((c) => (
                <span key={c.id} className="meta-pill">
                  <span className="cat-dot" style={{ background: c.color }} />
                  {c.name}
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 22, height: 22 }}
                    aria-label="O‘chirish"
                    onClick={() => void deleteCategory(c.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="inline-form">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Yangi kategoriya"
                aria-label="Yangi kategoriya"
              />
              <button className="btn btn-ghost" type="button" onClick={() => void addCategory()}>
                Qo‘shish
              </button>
            </div>
          </section>

          {inbox.length > 0 ? (
            <section className="inbox" aria-label="Eslatmalar">
              <h2>Eslatmalar</h2>
              {inbox.slice(0, 5).map((item) => (
                <div key={item.id} className={`inbox-item${item.read ? "" : " unread"}`}>
                  {item.body}
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}

      {view === "overview" ? (
        stats ? (
          <>
            <section className="progress-hero">
              <div className="progress-row">
                <p className="progress-label">Kunlik ko‘rsatkich</p>
                <p className={`progress-value tone-${stats.day.tone}`}>{stats.day.label}</p>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill tone-${stats.day.tone}`}
                  style={{ width: `${stats.day.percent ?? 0}%` }}
                />
              </div>
            </section>
            <StatsPanel
              day={stats.day}
              week={stats.week}
              month={stats.month}
              trend={stats.trend}
              trendDelta={stats.trendDelta}
              streak={stats.streak}
              ranges={stats.ranges}
            />
          </>
        ) : (
          <p className="empty">Natijalar yuklanmoqda…</p>
        )
      ) : null}

      {view === "calendar" ? (
        <>
          <DateNavigator
            date={selectedDate}
            onChange={(d) => {
              setSelectedDate(d);
              setView("tasks");
            }}
            dayMeta={calDays}
          />
          <div className="panel-card">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Oy ko‘rinishi
            </h3>
            <p className="empty">
              Rangli nuqta: qizil 0–49%, sariq 50–79%, yashil 80–100%. Bo‘sh kun — neytral.
            </p>
            <div className="calendar-panel" style={{ marginTop: "0.75rem" }}>
              <div className="calendar-dow">
                {["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {(() => {
                  const { y, m } = parseIsoDate(selectedDate);
                  const meta = new Map(calDays.map((d) => [d.date, d]));
                  return daysInMonthGrid(y, m).map((cell, idx) =>
                    cell ? (
                      <button
                        key={cell}
                        type="button"
                        className={`calendar-day tone-${meta.get(cell)?.tone || "neutral"}${
                          cell === selectedDate ? " selected" : ""
                        }${cell === today ? " is-today" : ""}`}
                        onClick={() => {
                          setSelectedDate(cell);
                          setView("tasks");
                        }}
                      >
                        {Number(cell.slice(-2))}
                        {(meta.get(cell)?.total ?? 0) > 0 ? <div className="dot" /> : null}
                      </button>
                    ) : (
                      <span key={`e-${idx}`} className="calendar-empty" />
                    ),
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {view === "stats" ? (
        stats ? (
          <>
            <StatsPanel
              day={stats.day}
              week={stats.week}
              month={stats.month}
              trend={stats.trend}
              trendDelta={stats.trendDelta}
              streak={stats.streak}
              ranges={stats.ranges}
            />
            <section className="panel-card">
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Yutuqlar
              </h3>
              <div className="achievements">
                {(achievements.length
                  ? achievements
                  : [
                      { code: "first_perfect", title: "Birinchi mukammal kun", unlocked: stats.streak >= 1 },
                      { code: "streak_3", title: "3 kunlik zanjir", unlocked: stats.streak >= 3 },
                      { code: "streak_7", title: "7 kunlik zanjir", unlocked: stats.streak >= 7 },
                      {
                        code: "month_80",
                        title: "Oylik 80%+",
                        unlocked: (stats.month.percent ?? 0) >= 80,
                      },
                    ]
                ).map((a) => (
                  <div key={a.code} className={`achievement${a.unlocked ? "" : " locked"}`}>
                    {a.title} {a.unlocked ? "✓" : ""}
                  </div>
                ))}
              </div>
            </section>
            <section className="panel-card">
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Qaydlar
              </h3>
              <div className="inline-form" style={{ marginBottom: "0.65rem" }}>
                <input
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Yangi qayd…"
                  aria-label="Yangi qayd"
                />
                <button className="btn btn-primary" type="button" onClick={() => void addNote()}>
                  Saqlash
                </button>
              </div>
              <div className="notes-list">
                {notes.length === 0 ? (
                  <p className="empty">Hali qayd yo‘q.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="note-item note-row">
                      <p>{n.body}</p>
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label="Qaydni o‘chirish"
                        onClick={() => void deleteNote(n.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="empty">Statistika yuklanmoqda…</p>
        )
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
