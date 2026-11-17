"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthForm } from "./AuthForm";
import { CashControl } from "./CashControl";
import { DateNavigator } from "./DateNavigator";
import { PwaChrome, requestBrowserNotifyPermission, sendLocalNotify } from "./PwaChrome";
import { type Category, type TaskDraft } from "./TaskForm";
import { TaskSheet } from "./TaskSheet";
import {
  daysInMonthGrid,
  describeUzbekDate,
  parseIsoDate,
  todayIso,
} from "@/lib/dates";
import { t } from "@/lib/i18n";
import { scheduleLabelUz, type ScheduleType } from "@/lib/schedule";

type View =
  | "home"
  | "tasks"
  | "calendar"
  | "goals"
  | "stats"
  | "achievements"
  | "journal"
  | "focus"
  | "cash"
  | "insights"
  | "settings"
  | "more";

type CashCat = { id: string; name: string; color: string; kind: string };

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
type Progress = { completed: number; total: number; percent: number | null; tone: string; label: string };
type Goal = {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  unit: string;
  period: string;
  current: number;
  percent: number;
  done: boolean;
};
type Insight = { id: string; title: string; body: string; tone: string };
type HeatDay = { date: string; level: number; label: string; total: number };
type Note = { id: string; body: string };
type Achievement = { code: string; title: string; unlocked: boolean };
type Settings = {
  theme: string;
  density: string;
  weekStartsOn: number;
  focusWorkMinutes: number;
  focusBreakMinutes: number;
  locale: string;
  timezone: string;
  notifyIncomplete: boolean;
  notifyFocus: boolean;
  notifyJournal: boolean;
  defaultPriority: string;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "forest",
  density: "comfortable",
  weekStartsOn: 1,
  focusWorkMinutes: 25,
  focusBreakMinutes: 5,
  locale: "uz",
  timezone: "Asia/Tashkent",
  notifyIncomplete: true,
  notifyFocus: true,
  notifyJournal: false,
  defaultPriority: "normal",
};

function applyTheme(theme: string) {
  const value = theme === "midnight" || theme === "dark" ? "midnight" : "forest";
  document.documentElement.setAttribute("data-theme", value);
  document.documentElement.setAttribute("data-appearance", theme);
}
type FocusSession = {
  id: string;
  mode: string;
  plannedSeconds: number;
  elapsedSeconds: number;
  status: string;
  startedAt: string;
};
type JournalEntry = { id: string; date: string; mood: string; body: string; gratitude: string };
type CalDay = { date: string; tone: string; total: number };
type WeekDay = { date: string; tasks: Task[]; progress: Progress };

const NAV_IDS: { id: View; ico: string }[] = [
  { id: "home", ico: "⌂" },
  { id: "tasks", ico: "✓" },
  { id: "calendar", ico: "▦" },
  { id: "stats", ico: "▤" },
  { id: "cash", ico: "◈" },
  { id: "insights", ico: "✧" },
  { id: "goals", ico: "◎" },
  { id: "achievements", ico: "★" },
  { id: "journal", ico: "✎" },
  { id: "focus", ico: "⏱" },
  { id: "settings", ico: "⚙" },
];

const MOBILE_PRIMARY: View[] = ["home", "tasks", "calendar", "stats", "more"];
const MORE_ITEMS: View[] = ["cash", "insights", "goals", "focus", "journal", "achievements", "settings"];

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

function fmtMin(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DistiplineApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cashCategories, setCashCategories] = useState<CashCat[]>([]);
  const [newCashCatName, setNewCashCatName] = useState("");
  const [newCashCatColor, setNewCashCatColor] = useState("#2f7a55");
  const [progress, setProgress] = useState<Progress>({
    completed: 0,
    total: 0,
    percent: null,
    tone: "neutral",
    label: "—",
  });
  const [stats, setStats] = useState<any>(null);
  const [calDays, setCalDays] = useState<CalDay[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [calMode, setCalMode] = useState<"month" | "week">("month");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [heatmap, setHeatmap] = useState<HeatDay[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [focusTotals, setFocusTotals] = useState({ seconds: 0, count: 0 });
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [journalList, setJournalList] = useState<JournalEntry[]>([]);
  const [banner, setBanner] = useState<{ id: string; body: string } | null>(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<"order" | "name" | "status">("order");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifyPerm, setNotifyPerm] = useState<string>("default");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("7");
  const [noteBody, setNoteBody] = useState("");
  const [jMood, setJMood] = useState("neutral");
  const [jBody, setJBody] = useState("");
  const [jGratitude, setJGratitude] = useState("");
  const [timerMode, setTimerMode] = useState<"pomodoro" | "break">("pomodoro");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLeft, setTimerLeft] = useState(25 * 60);
  const [timerElapsed, setTimerElapsed] = useState(0);

  const today = todayIso();
  const isToday = selectedDate === today;
  const dateInfo = describeUzbekDate(selectedDate);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadTasks = useCallback(async (date: string, remind = false) => {
    const qs = new URLSearchParams({ date });
    if (remind && date === todayIso()) qs.set("remind", "1");
    const res = await fetch(`/api/tasks?${qs}`);
    if (res.status === 401) {
      setUser(null);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setCategories(data.categories ?? []);
    setProgress(data.progress ?? { completed: 0, total: 0, percent: null, tone: "neutral", label: "—" });
    if (data.reminder) {
      setBanner(data.reminder);
      flash(data.reminder.body);
    }
  }, []);

  const loadCashCategories = useCallback(async () => {
    const res = await fetch("/api/cash/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCashCategories(data.categories ?? []);
  }, []);

  const loadShared = useCallback(async (date: string) => {
    const [st, cal, week, goalsRes, insightRes, heat, notesRes, ach, setRes, focusRes, jour, cashCats] =
      await Promise.all([
        fetch(`/api/stats?date=${date}`),
        fetch(`/api/calendar?month=${date.slice(0, 7)}`),
        fetch(`/api/calendar/week?date=${date}`),
        fetch("/api/goals"),
        fetch("/api/insights"),
        fetch("/api/heatmap?days=140"),
        fetch("/api/notes"),
        fetch("/api/achievements"),
        fetch("/api/settings"),
        fetch("/api/focus"),
        fetch(`/api/journal?date=${date}`),
        fetch("/api/cash/categories"),
      ]);
    if (st.ok) setStats(await st.json());
    if (cal.ok) setCalDays((await cal.json()).days ?? []);
    if (week.ok) setWeekDays((await week.json()).days ?? []);
    if (goalsRes.ok) setGoals((await goalsRes.json()).goals ?? []);
    if (insightRes.ok) setInsights((await insightRes.json()).insights ?? []);
    if (heat.ok) setHeatmap((await heat.json()).days ?? []);
    if (notesRes.ok) setNotes((await notesRes.json()).notes ?? []);
    if (ach.ok) setAchievements((await ach.json()).catalog ?? []);
    if (cashCats.ok) setCashCategories((await cashCats.json()).categories ?? []);
    if (setRes.ok) {
      const s = { ...DEFAULT_SETTINGS, ...(await setRes.json()).settings };
      setSettings(s);
      setSettingsReady(true);
      applyTheme(s.theme);
      document.documentElement.lang = s.locale === "ru" ? "ru" : s.locale === "en" ? "en" : "uz";
    }
    if (focusRes.ok) {
      const f = await focusRes.json();
      setFocusSessions(f.sessions ?? []);
      setFocusTotals(f.totals ?? { seconds: 0, count: 0 });
      if (f.settings?.workMinutes && !timerRunning) {
        setTimerLeft((f.settings.workMinutes || 25) * 60);
      }
    }
    if (jour.ok) {
      const j = await jour.json();
      setJournal(j.entry);
      if (j.entry) {
        setJMood(j.entry.mood);
        setJBody(j.entry.body);
        setJGratitude(j.entry.gratitude);
      } else {
        setJMood("neutral");
        setJBody("");
        setJGratitude("");
      }
    }
    const list = await fetch("/api/journal");
    if (list.ok) setJournalList((await list.json()).entries ?? []);
  }, [timerRunning]);

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
      await loadTasks(date, true);
      await loadShared(date);
    } finally {
      setReady(true);
    }
  }, [loadShared, loadTasks]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPerm("unsupported");
      return;
    }
    setNotifyPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user || !ready) return;
    void loadTasks(selectedDate, selectedDate === todayIso());
    void loadShared(selectedDate);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || view !== "settings") return;
    void (async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        setSettingsReady(true);
        return;
      }
      const s = { ...DEFAULT_SETTINGS, ...(await res.json()).settings };
      setSettings(s);
      setSettingsReady(true);
      applyTheme(s.theme);
      document.documentElement.lang = s.locale === "ru" ? "ru" : s.locale === "en" ? "en" : "uz";
      await loadCashCategories();
    })();
  }, [view, user, loadCashCategories]);

  async function patchSettings(patch: Partial<Settings>) {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    if (patch.theme) applyTheme(patch.theme);
    if (patch.locale) {
      document.documentElement.lang =
        patch.locale === "ru" ? "ru" : patch.locale === "en" ? "en" : "uz";
    }
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      flash("Sozlama saqlanmadi");
      return;
    }
    const data = await res.json();
    const next = { ...DEFAULT_SETTINGS, ...data.settings };
    setSettings(next);
    applyTheme(next.theme);
    document.documentElement.lang = next.locale === "ru" ? "ru" : next.locale === "en" ? "en" : "uz";
    flash("Sozlama saqlandi");
  }

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          setTimerRunning(false);
          if (settings.notifyFocus) {
            sendLocalNotify("Discipline · Focus", "Sessiya tugadi — saqlashni unutmang.");
            flash("Focus vaqti tugadi");
          }
          return 0;
        }
        return v - 1;
      });
      setTimerElapsed((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, settings.notifyFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
    }
    if (categoryFilter) list = list.filter((t) => t.categoryId === categoryFilter);
    if (sortMode === "name") list.sort((a, b) => a.title.localeCompare(b.title, "uz"));
    if (sortMode === "status") list.sort((a, b) => Number(a.done) - Number(b.done));
    return list;
  }, [tasks, query, categoryFilter, sortMode]);

  async function refreshAll() {
    await loadTasks(selectedDate);
    await loadShared(selectedDate);
  }

  async function createTask(draft: TaskDraft) {
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
    await refreshAll();
  }

  async function saveEdit(draft: TaskDraft) {
    if (!editing) return;
    await fetch(`/api/tasks/${editing.id}`, {
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
    setEditing(null);
    await refreshAll();
  }

  async function toggleTask(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done, date: selectedDate }),
    });
    await refreshAll();
  }

  async function removeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await refreshAll();
  }

  async function reschedule(task: Task, toDate: string) {
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
          categoryId: task.categoryId,
          notes: `Asl sana: ${task.occurrenceDate}`,
        }),
      });
    }
    setSelectedDate(toDate);
    flash("Vazifa qayta rejalashtirildi");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (passwordBusy) return;
    const loc = settings.locale || "uz";
    if (newPassword !== confirmPassword) {
      flash(t(loc, "auth.mismatch"));
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(data.error || t(loc, "auth.error"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      flash(t(loc, "settings.passwordChanged"));
    } catch {
      flash(t(loc, "auth.network"));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function saveFocus(status: "completed" | "aborted") {
    const planned =
      (timerMode === "break" ? settings?.focusBreakMinutes || 5 : settings?.focusWorkMinutes || 25) * 60;
    const elapsed = status === "completed" && timerLeft === 0 ? planned : timerElapsed;
    if (elapsed < 5) {
      flash("Sessiya juda qisqa");
      return;
    }
    const res = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: timerMode,
        plannedSeconds: planned,
        elapsedSeconds: elapsed,
        status,
      }),
    });
    if (res.ok) {
      flash(status === "completed" ? "Focus sessiyasi saqlandi" : "Sessiya to‘xtatildi");
      setTimerRunning(false);
      setTimerElapsed(0);
      setTimerLeft(planned);
      await loadShared(selectedDate);
    }
  }

  async function saveJournal(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        mood: jMood,
        body: jBody,
        gratitude: jGratitude,
      }),
    });
    if (res.ok) {
      flash("Kundalik saqlandi");
      await loadShared(selectedDate);
    }
  }

  if (!ready) {
    return (
      <div className="auth-shell">
        <p className="muted">{t(settings.locale, "loading")}</p>
      </div>
    );
  }
  if (!user) return <AuthForm onSuccess={() => void bootstrap()} />;

  const locale = settings.locale || "uz";
  const greeting = user.displayName || user.email.split("@")[0];
  const navItems = NAV_IDS.map((item) => ({
    ...item,
    label: t(locale, `nav.${item.id}`),
    short: t(locale, `nav.short.${item.id}`),
  }));
  const titleMap: Record<View, { h: string; p: string }> = {
    home: { h: t(locale, "title.home"), p: t(locale, "desc.home") },
    tasks: { h: t(locale, "title.tasks"), p: t(locale, "desc.tasks") },
    calendar: { h: t(locale, "title.calendar"), p: t(locale, "desc.calendar") },
    goals: { h: t(locale, "title.goals"), p: t(locale, "desc.goals") },
    stats: { h: t(locale, "title.stats"), p: t(locale, "desc.stats") },
    achievements: { h: t(locale, "title.achievements"), p: t(locale, "desc.achievements") },
    journal: { h: t(locale, "title.journal"), p: t(locale, "desc.journal") },
    focus: { h: t(locale, "title.focus"), p: t(locale, "desc.focus") },
    cash: { h: t(locale, "title.cash"), p: t(locale, "desc.cash") },
    insights: { h: t(locale, "title.insights"), p: t(locale, "desc.insights") },
    settings: { h: t(locale, "title.settings"), p: t(locale, "desc.settings") },
    more: { h: t(locale, "title.more"), p: t(locale, "desc.more") },
  };
  const heroInsight = insights[0] ?? null;
  const moreInsights = insights.slice(1);

  function go(next: View) {
    if (next === "more") {
      setMoreOpen(true);
      return;
    }
    setView(next);
    setMoreOpen(false);
  }

  function renderTask(task: Task, overdue = false) {
    return (
      <li key={`${task.id}-${task.occurrenceDate}`} className={`task-item${task.done ? " done" : ""}${overdue ? " overdue" : ""}`}>
        <button className="check" type="button" onClick={() => void toggleTask(task)} aria-label="Belgilash">
          ✓
        </button>
        <div>
          <p className="task-title">{task.title}</p>
          <div className="task-meta">
            <span className="meta-pill">
              {scheduleLabelUz({
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
              })}
            </span>
            {task.categoryName ? (
              <span className="meta-pill">
                <span className="cat-dot" style={{ background: task.categoryColor || "#2f7a55" }} />
                {task.categoryName}
              </span>
            ) : null}
          </div>
          <div className="row-actions" style={{ marginTop: "0.4rem" }}>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(task)}>
              Tahrirlash
            </button>
            {overdue ? (
              <button className="btn btn-ghost" type="button" onClick={() => void reschedule(task, today)}>
                Bugunga
              </button>
            ) : null}
          </div>
        </div>
        <button className="icon-btn" type="button" aria-label="O‘chirish" onClick={() => void removeTask(task.id)}>
          ×
        </button>
      </li>
    );
  }

  const open = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done);

  const mobileNavActive = (id: View) => {
    if (id === "more") return MORE_ITEMS.includes(view) || moreOpen;
    return view === id;
  };

  return (
    <>
      <PwaChrome onFlash={flash} />
      <div className={`app-frame view-${view}`} data-density={settings?.density || "comfortable"}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Discipline</h1>
          <p>{t(locale, "brand.tagline")}</p>
        </div>
        <nav className="nav-list" aria-label="Asosiy menyu">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${view === item.id ? " active" : ""}`}
              onClick={() => go(item.id)}
            >
              <span className="nav-ico">{item.ico}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-line">{t(locale, "hello", { name: greeting })}</div>
          <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
            {t(locale, "nav.logout")}
          </button>
        </div>
      </aside>

      <div className="main-pane">
        <div className="mobile-top">
          <div>
            <h1>Discipline</h1>
            <p className="mobile-top-sub">{dateInfo.shortLabel}</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => go("settings")}>
            {t(locale, "nav.short.settings")}
          </button>
        </div>

        <div className="main-inner">
          <header className="page-head">
            <h2>{titleMap[view].h}</h2>
            <p>{titleMap[view].p}</p>
          </header>

          {view === "home" ? (
            <div className="mobile-home">
              <div className="grid-3" style={{ marginBottom: "0.9rem" }}>
                <div className="card">
                  <h3>{t(locale, "home.today")}</h3>
                  <p className={`stat-num tone-${progress.tone}`}>{progress.label}</p>
                  <p className="muted">
                    {progress.completed}/{progress.total} · {dateInfo.shortLabel}
                  </p>
                  <div className="progress-track">
                    <div className={`progress-fill tone-${progress.tone}`} style={{ width: `${progress.percent ?? 0}%` }} />
                  </div>
                </div>
                <div className="card">
                  <h3>{t(locale, "home.streak")}</h3>
                  <p className="stat-num tone-high">{stats?.streak ?? 0}</p>
                  <p className="muted">{t(locale, "home.streakHint")}</p>
                </div>
                <div className="card">
                  <h3>{t(locale, "home.focus")}</h3>
                  <p className="stat-num">{Math.round(focusTotals.seconds / 60)}</p>
                  <p className="muted">{t(locale, "home.focusHint", { count: focusTotals.count })}</p>
                </div>
              </div>
              <div className="grid-2">
                <div className="card">
                  <h3>{t(locale, "home.smartInsight")}</h3>
                  {insights.length === 0 ? (
                    <div className="empty-state">
                      <strong>{t(locale, "insights.emptyTitle")}</strong>
                      <p>{t(locale, "insights.emptyBody")}</p>
                    </div>
                  ) : (
                    <>
                      {heroInsight ? (
                        <div className={`insight tone-${heroInsight.tone}`}>
                          <strong>{heroInsight.title}</strong>
                          <span className="muted">{heroInsight.body}</span>
                        </div>
                      ) : null}
                      <button className="btn btn-ghost" type="button" onClick={() => go("insights")}>
                        {t(locale, "insights.viewAll")}
                      </button>
                    </>
                  )}
                </div>
                <div className="card">
                  <h3>{t(locale, "home.quick")}</h3>
                  <div className="composer-actions">
                    <button className="btn btn-primary" type="button" onClick={() => { setView("tasks"); setShowCreate(true); }}>
                      + {t(locale, "nav.tasks")}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => go("focus")}>
                      Focus
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => go("cash")}>
                      {t(locale, "nav.short.cash")}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => go("journal")}>
                      {t(locale, "nav.journal")}
                    </button>
                  </div>
                  {banner ? (
                    <div className="banner" style={{ marginTop: "0.8rem" }}>
                      <p style={{ margin: 0 }}>{banner.body}</p>
                    </div>
                  ) : null}
                  <h3 style={{ marginTop: "1rem" }}>{t(locale, "home.openToday")}</h3>
                  {open.length === 0 ? (
                    <div className="empty-state compact">
                      <strong>{t(locale, "home.allClear")}</strong>
                      <p>{t(locale, "home.noOpen")}</p>
                    </div>
                  ) : (
                    <ul className="task-list home-tasks">{open.slice(0, 4).map((t) => renderTask(t))}</ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {view === "insights" ? (
            <div className="insights-page">
              {insights.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <strong>{t(locale, "insights.emptyTitle")}</strong>
                    <p>{t(locale, "insights.emptyBody")}</p>
                  </div>
                </div>
              ) : (
                <>
                  {heroInsight ? (
                    <div className={`insight-hero tone-${heroInsight.tone}`}>
                      <p className="eyebrow">{t(locale, "insights.hero")}</p>
                      <h3>{heroInsight.title}</h3>
                      <p className="muted" style={{ margin: 0 }}>
                        {heroInsight.body}
                      </p>
                    </div>
                  ) : null}
                  {moreInsights.length > 0 ? (
                    <div className="card">
                      <h3>{t(locale, "insights.more")}</h3>
                      {moreInsights.map((i) => (
                        <div key={i.id} className={`insight tone-${i.tone}`}>
                          <strong>{i.title}</strong>
                          <span className="muted">{i.body}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {view === "tasks" ? (
            <div className="mobile-tasks">
              <DateNavigator date={selectedDate} onChange={setSelectedDate} dayMeta={calDays} />
              <div className="card" style={{ marginBottom: "0.85rem" }}>
                <div className="tasks-progress-row">
                  <div>
                    <p className="muted" style={{ margin: 0 }}>
                      {progress.completed}/{progress.total} bajarildi
                    </p>
                    <p className={`stat-num tone-${progress.tone}`}>{progress.label}</p>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={() => setShowCreate(true)}>
                    + Yangi
                  </button>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill tone-${progress.tone}`} style={{ width: `${progress.percent ?? 0}%` }} />
                </div>
              </div>
              <div className="filters">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qidiruv…" />
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
              <h3 className="section-title">
                {selectedDate < today ? "O‘tkazib yuborilgan" : selectedDate > today ? "Rejalashtirilgan" : "Bugun"}
              </h3>
              {open.length === 0 ? (
                <div className="empty-state">
                  <strong>Ochiq vazifa yo‘q</strong>
                  <p>Yangi vazifa qo‘shing yoki sanani o‘zgartiring.</p>
                  <button className="btn btn-primary" type="button" onClick={() => setShowCreate(true)}>
                    Vazifa yaratish
                  </button>
                </div>
              ) : (
                <ul className="task-list">{open.map((t) => renderTask(t, selectedDate < today))}</ul>
              )}
              {done.length > 0 ? (
                <>
                  <h3 className="section-title">Bajarilgan</h3>
                  <ul className="task-list">{done.map((t) => renderTask(t))}</ul>
                </>
              ) : null}
            </div>
          ) : null}

          {view === "calendar" ? (
            <div className="mobile-calendar">
              <div className="composer-actions" style={{ marginBottom: "0.75rem" }}>
                <button className={`btn ${calMode === "month" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setCalMode("month")}>
                  Oy
                </button>
                <button className={`btn ${calMode === "week" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setCalMode("week")}>
                  Hafta
                </button>
              </div>
              <DateNavigator date={selectedDate} onChange={setSelectedDate} dayMeta={calDays} />
              {calMode === "month" ? (
                <div className="card">
                  <h3>Oy ko‘rinishi</h3>
                  <p className="muted">Nuqta: qizil 0–49 · sariq 50–79 · yashil 80–100</p>
                  <div className="calendar-panel">
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
                              className={`calendar-day tone-${meta.get(cell)?.tone || "neutral"}${cell === selectedDate ? " selected" : ""}${cell === today ? " is-today" : ""}`}
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
              ) : (
                <div className="week-grid">
                  {weekDays.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className="week-col"
                      onClick={() => {
                        setSelectedDate(d.date);
                        setView("tasks");
                      }}
                      style={{ textAlign: "left", cursor: "pointer" }}
                    >
                      <h4>
                        {describeUzbekDate(d.date).weekdayTitle} {d.date.slice(8)}
                      </h4>
                      <p className={`stat-num tone-${d.progress.tone}`} style={{ fontSize: "1.2rem" }}>
                        {d.progress.label}
                      </p>
                      {d.tasks.slice(0, 4).map((t) => (
                        <div key={t.id} className={`week-task${t.done ? " done" : ""}`}>
                          {t.title}
                        </div>
                      ))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {view === "goals" ? (
            <>
              <div className="card" style={{ marginBottom: "0.85rem" }}>
                <h3>Yangi maqsad</h3>
                <div className="inline-form">
                  <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Masalan: 5 kun yugurish" />
                  <input
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    type="number"
                    min={1}
                    style={{ maxWidth: 90 }}
                    aria-label="Maqsad soni"
                  />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={async () => {
                      if (!goalTitle.trim()) return;
                      await fetch("/api/goals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: goalTitle.trim(), targetCount: Number(goalTarget) || 1, period: "week" }),
                      });
                      setGoalTitle("");
                      await loadShared(selectedDate);
                    }}
                  >
                    Qo‘shish
                  </button>
                </div>
              </div>
              <div className="grid-2">
                {goals.length === 0 ? (
                  <p className="empty">Hali maqsad yo‘q.</p>
                ) : (
                  goals.map((g) => (
                    <div key={g.id} className="card">
                      <h3>{g.title}</h3>
                      <p className={`stat-num tone-${g.percent >= 80 ? "high" : g.percent >= 50 ? "mid" : g.current ? "low" : "neutral"}`}>
                        {g.percent}%
                      </p>
                      <p className="muted">
                        {g.current}/{g.targetCount} {g.unit}
                      </p>
                      <div className="progress-track">
                        <div
                          className={`progress-fill tone-${g.percent >= 80 ? "high" : g.percent >= 50 ? "mid" : g.current ? "low" : "neutral"}`}
                          style={{ width: `${g.percent}%` }}
                        />
                      </div>
                      <div className="composer-actions" style={{ marginTop: "0.7rem" }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/goals/${g.id}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ amount: 1 }),
                            });
                            await loadShared(selectedDate);
                          }}
                        >
                          +1
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/goals/${g.id}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "archive" }),
                            });
                            await loadShared(selectedDate);
                          }}
                        >
                          Arxiv
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}

          {view === "stats" ? (
            <div className="mobile-stats">
              <div className="grid-3" style={{ marginBottom: "0.85rem" }}>
                <div className="card">
                  <h3>Kun</h3>
                  <p className={`stat-num tone-${stats?.day?.tone || "neutral"}`}>{stats?.day?.label ?? "—"}</p>
                </div>
                <div className="card">
                  <h3>Hafta</h3>
                  <p className={`stat-num tone-${stats?.week?.tone || "neutral"}`}>{stats?.week?.label ?? "—"}</p>
                </div>
                <div className="card">
                  <h3>Oy</h3>
                  <p className={`stat-num tone-${stats?.month?.tone || "neutral"}`}>{stats?.month?.label ?? "—"}</p>
                </div>
              </div>
              <div className="card" style={{ marginBottom: "0.85rem" }}>
                <h3>7 kunlik trend</h3>
                {!stats?.trend?.length ? (
                  <div className="empty-state compact">
                    <strong>Trend hali yo‘q</strong>
                    <p>Kunlik vazifalar belgilanganda grafik paydo bo‘ladi.</p>
                  </div>
                ) : (
                  <div className="stats-bars">
                    {(stats?.trend || []).map((point: any) => {
                      const max = Math.max(1, ...(stats?.trend || []).map((t: any) => t.percent ?? 0));
                      const h = point.percent === null ? 0 : Math.round((point.percent / max) * 100);
                      return (
                        <div key={point.date} className="stats-bar-col">
                          <div className="stats-bar-track">
                            <div className={`stats-bar-fill tone-${point.tone || "neutral"}`} style={{ height: `${h}%` }} />
                          </div>
                          <span>{Number(point.date.slice(-2))}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="card">
                <div className="heatmap-head">
                  <div>
                    <h3>Faollik heatmap</h3>
                    <p className="muted">So‘nggi ~20 hafta · haqiqiy bajarilish</p>
                  </div>
                  <div className="heat-legend" aria-hidden>
                    <span>Kam</span>
                    <i className="heat-cell l1" />
                    <i className="heat-cell l2" />
                    <i className="heat-cell l3" />
                    <i className="heat-cell l4" />
                    <span>Ko‘p</span>
                  </div>
                </div>
                {heatmap.length === 0 ? (
                  <div className="empty-state compact">
                    <strong>Heatmap bo‘sh</strong>
                    <p>Ma’lumot to‘planganda kataklar to‘ladi.</p>
                  </div>
                ) : (
                  <div className="heatmap" aria-label="Heatmap">
                    {heatmap.map((d) => (
                      <div key={d.date} className={`heat-cell l${d.level}`} title={`${d.date}: ${d.label}`} />
                    ))}
                  </div>
                )}
              </div>
              <div className="card" style={{ marginTop: "0.85rem" }}>
                <h3>Streak</h3>
                <p className={`stat-num tone-high`}>{stats?.streak ?? 0}</p>
                <p className="muted">ketma-ket mukammal kunlar</p>
              </div>
            </div>
          ) : null}

          {view === "cash" ? <CashControl onFlash={flash} /> : null}

          {view === "achievements" ? (
            <div className="card">
              <h3>Yutuqlar</h3>
              <p className="muted">Faqat haqiqiy streak/oy foizidan ochiladi.</p>
              <div className="achievements" style={{ marginTop: "0.7rem" }}>
                {achievements.map((a) => (
                  <div key={a.code} className={`achievement${a.unlocked ? "" : " locked"}`}>
                    {a.title} {a.unlocked ? "✓" : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {view === "journal" ? (
            <div className="grid-2">
              <form className="card" onSubmit={saveJournal}>
                <h3>{isToday ? "Bugungi kundalik" : dateInfo.shortLabel}</h3>
                <DateNavigator date={selectedDate} onChange={setSelectedDate} />
                <div className="mood-row">
                  {[
                    ["great", "A’lo"],
                    ["good", "Yaxshi"],
                    ["neutral", "Oddiy"],
                    ["low", "Og‘ir"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mood-chip${jMood === id ? " on" : ""}`}
                      onClick={() => setJMood(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label>Yozuv</label>
                  <textarea value={jBody} onChange={(e) => setJBody(e.target.value)} placeholder="Bugun nima bo‘ldi?" />
                </div>
                <div className="field">
                  <label>Minnatdorchilik</label>
                  <textarea value={jGratitude} onChange={(e) => setJGratitude(e.target.value)} placeholder="Nima uchun minnatdorman?" />
                </div>
                <button className="btn btn-primary" type="submit">
                  Saqlash
                </button>
              </form>
              <div className="card">
                <h3>Oldingi yozuvlar</h3>
                {journalList.length === 0 ? (
                  <p className="empty">Hali yozuv yo‘q.</p>
                ) : (
                  journalList.slice(0, 12).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="journal-item"
                      style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                      onClick={() => setSelectedDate(e.date)}
                    >
                      <strong>{e.date}</strong> · {e.mood}
                      <p>{e.body || e.gratitude}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {view === "focus" ? (
            <div className="grid-2 mobile-focus">
              <div className="card focus-timer">
                <div className="composer-actions" style={{ justifyContent: "center" }}>
                  <button
                    className={`btn ${timerMode === "pomodoro" ? "btn-primary" : "btn-ghost"}`}
                    type="button"
                    onClick={() => {
                      setTimerMode("pomodoro");
                      setTimerRunning(false);
                      setTimerElapsed(0);
                      setTimerLeft((settings?.focusWorkMinutes || 25) * 60);
                    }}
                  >
                    Ish
                  </button>
                  <button
                    className={`btn ${timerMode === "break" ? "btn-primary" : "btn-ghost"}`}
                    type="button"
                    onClick={() => {
                      setTimerMode("break");
                      setTimerRunning(false);
                      setTimerElapsed(0);
                      setTimerLeft((settings?.focusBreakMinutes || 5) * 60);
                    }}
                  >
                    Tanaffus
                  </button>
                </div>
                <p className="focus-clock">{fmtMin(timerLeft)}</p>
                <div className="focus-actions">
                  {!timerRunning ? (
                    <button className="btn btn-primary" type="button" onClick={() => setTimerRunning(true)}>
                      Boshlash
                    </button>
                  ) : (
                    <button className="btn btn-ghost" type="button" onClick={() => setTimerRunning(false)}>
                      Pauza
                    </button>
                  )}
                  <button
                    className="btn btn-amber"
                    type="button"
                    onClick={() => void saveFocus(timerLeft === 0 ? "completed" : "aborted")}
                  >
                    {timerLeft === 0 ? "Saqlash" : "To‘xtatish va saqlash"}
                  </button>
                </div>
                {timerLeft === 0 ? <p className="muted">Vaqt tugadi — saqlang.</p> : null}
              </div>
              <div className="card">
                <h3>Sessiyalar</h3>
                <p className="muted">
                  Jami {Math.round(focusTotals.seconds / 60)} daqiqa · {focusTotals.count} ta
                </p>
                {focusSessions.length === 0 ? (
                  <p className="empty">Hali sessiya yo‘q.</p>
                ) : (
                  focusSessions.slice(0, 12).map((s) => (
                    <div key={s.id} className="note-item">
                      <p>
                        <strong>{s.mode}</strong> · {Math.round(s.elapsedSeconds / 60)} daq · {s.status}
                      </p>
                      <p className="muted">{s.startedAt}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {view === "settings" ? (
            <div className="grid-2">
              <div className="card">
                <h3>{t(locale, "settings.password")}</h3>
                <form onSubmit={(e) => void changePassword(e)}>
                  <div className="field">
                    <label>{t(locale, "settings.currentPassword")}</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>{t(locale, "auth.newPassword")}</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t(locale, "auth.passwordHint")}
                    />
                  </div>
                  <div className="field">
                    <label>{t(locale, "auth.confirmPassword")}</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={passwordBusy}>
                    {passwordBusy ? t(locale, "auth.waiting") : t(locale, "settings.changePassword")}
                  </button>
                </form>
              </div>

              <div className="card">
                <h3>{t(locale, "settings.appearance")}</h3>
                {!settingsReady ? <p className="muted">{t(locale, "loading")}</p> : null}
                <div className="field">
                  <label>{t(locale, "settings.theme")}</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => void patchSettings({ theme: e.target.value })}
                  >
                    <option value="light">{t(locale, "theme.light")}</option>
                    <option value="forest">{t(locale, "theme.forest")}</option>
                    <option value="dark">{t(locale, "theme.dark")}</option>
                    <option value="midnight">{t(locale, "theme.midnight")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(locale, "settings.density")}</label>
                  <select
                    value={settings.density}
                    onChange={(e) => void patchSettings({ density: e.target.value })}
                  >
                    <option value="comfortable">{t(locale, "density.comfortable")}</option>
                    <option value="compact">{t(locale, "density.compact")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(locale, "settings.language")}</label>
                  <select
                    value={settings.locale === "ru" || settings.locale === "en" ? settings.locale : "uz"}
                    onChange={(e) => void patchSettings({ locale: e.target.value })}
                  >
                    <option value="uz">{t(locale, "lang.uz")}</option>
                    <option value="en">{t(locale, "lang.en")}</option>
                    <option value="ru">{t(locale, "lang.ru")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(locale, "settings.weekStarts")}</label>
                  <select
                    value={String(settings.weekStartsOn)}
                    onChange={(e) => void patchSettings({ weekStartsOn: Number(e.target.value) })}
                  >
                    <option value="1">{t(locale, "week.mon")}</option>
                    <option value="0">{t(locale, "week.sun")}</option>
                    <option value="6">{t(locale, "week.sat")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(locale, "settings.priority")}</label>
                  <select
                    value={settings.defaultPriority}
                    onChange={(e) => void patchSettings({ defaultPriority: e.target.value })}
                  >
                    <option value="low">{t(locale, "prio.low")}</option>
                    <option value="normal">{t(locale, "prio.normal")}</option>
                    <option value="high">{t(locale, "prio.high")}</option>
                  </select>
                </div>
                <p className="muted">{t(locale, "settings.timezone", { tz: settings.timezone })}</p>
              </div>

              <div className="card">
                <h3>{t(locale, "settings.notifications")}</h3>
                <p className="muted">
                  Ilova ichida banner/toast + brauzer Notification API (qo‘llab-quvvatlansa).
                </p>
                <div className="field">
                  <label>Brauzer ruxsati: {notifyPerm}</label>
                  {notifyPerm !== "granted" && notifyPerm !== "unsupported" ? (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={async () => {
                        const p = await requestBrowserNotifyPermission();
                        setNotifyPerm(p);
                        if (p === "granted") {
                          sendLocalNotify("Discipline", "Bildirishnomalar yoqildi.");
                          flash("Ruxsat berildi");
                        } else if (p === "denied") flash("Ruxsat rad etildi");
                        else if (p === "unsupported") flash("Bu brauzerda Notification yo‘q");
                      }}
                    >
                      Brauzer ruxsatini so‘rash
                    </button>
                  ) : null}
                  {notifyPerm === "unsupported" ? (
                    <p className="muted">Bu muhitda brauzer Notification API yo‘q — faqat ilova ichida.</p>
                  ) : null}
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.notifyIncomplete}
                      onChange={(e) => void patchSettings({ notifyIncomplete: e.target.checked })}
                      style={{ marginRight: "0.45rem" }}
                    />
                    Tugallanmagan vazifalar eslatmasi
                  </label>
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.notifyFocus}
                      onChange={(e) => void patchSettings({ notifyFocus: e.target.checked })}
                      style={{ marginRight: "0.45rem" }}
                    />
                    Focus sessiyasi tugaganda eslatma
                  </label>
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.notifyJournal}
                      onChange={(e) => void patchSettings({ notifyJournal: e.target.checked })}
                      style={{ marginRight: "0.45rem" }}
                    />
                    Kundalik yozish eslatmasi
                  </label>
                </div>
                <div className="card install-help-inline">
                  <h3>PWA o‘rnatish</h3>
                  <p className="muted">
                    Android: Chrome menyu → Add to Home screen. iPhone: Safari Ulashish → Add to Home Screen.
                    Desktop: manzil qatoridagi o‘rnatish ikonkasi.
                  </p>
                </div>

                <h3 style={{ marginTop: "1rem" }}>Timer (Focus)</h3>
                <div className="field">
                  <label>Ish davomiyligi (daqiqa)</label>
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={settings.focusWorkMinutes}
                    onChange={(e) =>
                      void patchSettings({ focusWorkMinutes: Math.max(5, Number(e.target.value) || 25) })
                    }
                  />
                </div>
                <div className="field">
                  <label>Tanaffus (daqiqa)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.focusBreakMinutes}
                    onChange={(e) =>
                      void patchSettings({ focusBreakMinutes: Math.max(1, Number(e.target.value) || 5) })
                    }
                  />
                </div>
              </div>

              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>{t(locale, "settings.cashCategories")}</h3>
                <p className="muted">{t(locale, "settings.cashCategoriesHint")}</p>
                <div className="inline-form with-color" style={{ marginBottom: "0.75rem" }}>
                  <input
                    value={newCashCatName}
                    onChange={(e) => setNewCashCatName(e.target.value)}
                    placeholder={t(locale, "settings.newCategory")}
                    aria-label={t(locale, "settings.newCategory")}
                  />
                  <input
                    type="color"
                    value={newCashCatColor}
                    onChange={(e) => setNewCashCatColor(e.target.value)}
                    aria-label={t(locale, "settings.color")}
                    title={t(locale, "settings.color")}
                  />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={async () => {
                      if (!newCashCatName.trim()) return;
                      const res = await fetch("/api/cash/categories", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newCashCatName.trim(), color: newCashCatColor }),
                      });
                      if (!res.ok) {
                        flash("Kategoriya saqlanmadi");
                        return;
                      }
                      setNewCashCatName("");
                      flash("Kategoriya qo‘shildi");
                      await loadCashCategories();
                    }}
                  >
                    {t(locale, "settings.add")}
                  </button>
                </div>
                {cashCategories.length === 0 ? (
                  <div className="empty-state">
                    <strong>{t(locale, "settings.noCashCats")}</strong>
                  </div>
                ) : (
                  <div className="cash-cat-manager">
                    {cashCategories.map((c) => (
                      <div key={c.id} className="cash-cat-row">
                        <span className="cat-dot" style={{ background: c.color }} />
                        <input
                          type="text"
                          defaultValue={c.name}
                          aria-label={t(locale, "settings.rename")}
                          onBlur={async (e) => {
                            const name = e.target.value.trim();
                            if (!name || name === c.name) return;
                            const res = await fetch(`/api/cash/categories/${c.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name }),
                            });
                            if (!res.ok) {
                              flash("Nom yangilanmadi");
                              e.target.value = c.name;
                              return;
                            }
                            flash("Nom yangilandi");
                            await loadCashCategories();
                          }}
                        />
                        <input
                          type="color"
                          value={c.color}
                          aria-label={t(locale, "settings.color")}
                          onChange={async (e) => {
                            const color = e.target.value;
                            const res = await fetch(`/api/cash/categories/${c.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ color }),
                            });
                            if (!res.ok) {
                              flash("Rang saqlanmadi");
                              return;
                            }
                            await loadCashCategories();
                          }}
                        />
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/cash/categories/${c.id}`, { method: "DELETE" });
                            flash("O‘chirildi");
                            await loadCashCategories();
                          }}
                        >
                          {t(locale, "settings.delete")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>Qaydlar</h3>
                <div className="inline-form" style={{ marginBottom: "0.55rem" }}>
                  <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Yangi qayd…" />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={async () => {
                      if (!noteBody.trim()) return;
                      await fetch("/api/notes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ body: noteBody.trim() }),
                      });
                      setNoteBody("");
                      await loadShared(selectedDate);
                    }}
                  >
                    Saqlash
                  </button>
                </div>
                {notes.length === 0 ? (
                  <p className="empty">Hali qayd yo‘q.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="note-item note-row">
                      <p>{n.body}</p>
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
                          await loadShared(selectedDate);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Mobil menyu">
        {MOBILE_PRIMARY.map((id) => {
          const item =
            id === "more"
              ? {
                  id: "more" as View,
                  label: t(locale, "nav.more"),
                  short: t(locale, "nav.short.more"),
                  ico: "⋯",
                }
              : navItems.find((n) => n.id === id)!;
          return (
            <button
              key={id}
              type="button"
              className={`mobile-nav-btn${mobileNavActive(id) ? " active" : ""}`}
              onClick={() => go(id)}
            >
              <span className="mobile-nav-ico" aria-hidden>
                {item.ico}
              </span>
              <span>{item.short}</span>
            </button>
          );
        })}
      </nav>

      {moreOpen ? (
        <div
          className="sheet-root more-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "nav.more")}
        >
          <button className="sheet-backdrop" type="button" onClick={() => setMoreOpen(false)} />
          <div className="sheet-panel">
            <div className="sheet-head">
              <h3>{t(locale, "nav.more")}</h3>
              <button className="icon-btn" type="button" onClick={() => setMoreOpen(false)}>
                ×
              </button>
            </div>
            <div className="more-grid">
              {MORE_ITEMS.map((id) => {
                const item = navItems.find((n) => n.id === id)!;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`more-item${view === id ? " active" : ""}`}
                    onClick={() => go(id)}
                  >
                    <span className="nav-ico">{item.ico}</span>
                    {item.label}
                  </button>
                );
              })}
              <button className="more-item danger" type="button" onClick={() => void logout()}>
                {t(locale, "nav.logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TaskSheet
        open={showCreate}
        title="Yangi vazifa"
        initial={emptyDraft(selectedDate)}
        categories={categories}
        submitLabel="Qo‘shish"
        onSubmit={createTask}
        onClose={() => setShowCreate(false)}
      />
      <TaskSheet
        open={!!editing}
        title="Vazifani tahrirlash"
        initial={
          editing
            ? {
                title: editing.title,
                scheduleType: editing.scheduleType,
                startDate: editing.startDate,
                endDate: editing.endDate || editing.startDate,
                weekdays: editing.weekdays,
                categoryId: editing.categoryId || "",
                notes: editing.notes,
              }
            : emptyDraft(selectedDate)
        }
        categories={categories}
        submitLabel="Saqlash"
        onSubmit={saveEdit}
        onClose={() => setEditing(null)}
      />

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
    </>
  );
}
