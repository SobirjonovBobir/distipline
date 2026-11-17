import { addDaysIso } from "./dates";
import { progressDisplay } from "./progress";
import { occursOnDate, type ScheduleType, type TaskDefinition } from "./schedule";
import { sql } from "./db";

type TaskRow = {
  id: string;
  title: string;
  schedule_type: string;
  start_date: string;
  end_date: string | null;
  weekdays: string;
  category_id: string | null;
  notes: string;
  archived: boolean;
  sort_order: number;
};

type CompletionRow = {
  task_id: string;
  occurrence_date: string;
  done: boolean;
};

function asDef(row: TaskRow): TaskDefinition {
  return {
    id: row.id,
    title: row.title,
    schedule_type: (row.schedule_type || "once") as ScheduleType,
    start_date: String(row.start_date).slice(0, 10),
    end_date: row.end_date ? String(row.end_date).slice(0, 10) : null,
    weekdays: row.weekdays || "",
    category_id: row.category_id,
    notes: row.notes || "",
    archived: !!row.archived,
    sort_order: row.sort_order,
  };
}

export async function loadDefs(userId: string) {
  const rows = await sql<TaskRow>(
    `select id, title, schedule_type, start_date::text as start_date, end_date::text as end_date,
            weekdays, category_id, notes, archived, sort_order
     from tasks where user_id = $1 and archived = false`,
    [userId],
  );
  return rows.map(asDef);
}

export async function summarizeRange(
  userId: string,
  from: string,
  to: string,
  defs?: TaskDefinition[],
) {
  const taskDefs = defs ?? (await loadDefs(userId));
  const completions = await sql<CompletionRow>(
    `select task_id, occurrence_date::text as occurrence_date, done
     from task_completions
     where user_id = $1 and occurrence_date >= $2 and occurrence_date <= $3`,
    [userId, from, to],
  );
  const done = new Set(
    completions
      .filter((c) => c.done)
      .map((c) => `${c.task_id}:${String(c.occurrence_date).slice(0, 10)}`),
  );

  let total = 0;
  let completed = 0;
  let daysWithTasks = 0;
  let cursor = from;
  const trend: {
    date: string;
    completed: number;
    total: number;
    percent: number | null;
    tone: string;
    label: string;
  }[] = [];

  while (cursor <= to) {
    const occurring = taskDefs.filter((d) => occursOnDate(d, cursor));
    const dayTotal = occurring.length;
    const dayCompleted = occurring.filter((d) => done.has(`${d.id}:${cursor}`)).length;
    if (dayTotal > 0) daysWithTasks += 1;
    total += dayTotal;
    completed += dayCompleted;
    const disp = progressDisplay(dayCompleted, dayTotal);
    trend.push({
      date: cursor,
      completed: dayCompleted,
      total: dayTotal,
      percent: disp.percent,
      tone: disp.tone,
      label: disp.label,
    });
    cursor = addDaysIso(cursor, 1);
    if (trend.length > 400) break;
  }

  return {
    ...progressDisplay(completed, total),
    daysWithTasks,
    trend,
  };
}

/** Consecutive 100% days ending at `date` (skip empty days breaks streak). */
export async function computeStreak(userId: string, date: string) {
  const defs = await loadDefs(userId);
  const from = addDaysIso(date, -120);
  const window = await summarizeRange(userId, from, date, defs);
  const byDate = new Map(window.trend.map((t) => [t.date, t]));
  let streak = 0;
  let cursor = date;
  for (let i = 0; i < 120; i++) {
    const day = byDate.get(cursor);
    if (!day || day.total === 0 || day.percent !== 100) break;
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
