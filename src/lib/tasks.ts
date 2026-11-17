import { sql } from "./db";
import { occursOnDate, type ScheduleType, type TaskDefinition } from "./schedule";
import { progressDisplay } from "./progress";
import { isValidDateIso } from "./dates";

export type Category = { id: string; name: string; color: string; sortOrder: number };

export type OccurrenceTask = {
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
  completionId: string | null;
};

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
  category_name: string | null;
  category_color: string | null;
};

type CompletionRow = {
  id: string;
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

export async function listCategories(userId: string): Promise<Category[]> {
  const rows = await sql<{ id: string; name: string; color: string; sort_order: number }>(
    `select id, name, color, sort_order from categories
     where user_id = $1 order by sort_order asc, created_at asc`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    sortOrder: r.sort_order,
  }));
}

async function ownedCategoryId(userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const rows = await sql<{ id: string }>(
    `select id from categories where id = $1 and user_id = $2 limit 1`,
    [categoryId, userId],
  );
  return rows[0]?.id ?? null;
}

async function loadTaskRows(userId: string) {
  return sql<TaskRow>(
    `select t.id, t.title, t.schedule_type,
            t.start_date::text as start_date,
            t.end_date::text as end_date,
            t.weekdays, t.category_id, t.notes, t.archived, t.sort_order,
            c.name as category_name, c.color as category_color
     from tasks t
     left join categories c on c.id = t.category_id and c.user_id = t.user_id
     where t.user_id = $1 and t.archived = false
     order by t.sort_order asc, t.created_at asc`,
    [userId],
  );
}

export async function tasksForDate(userId: string, date: string): Promise<{
  tasks: OccurrenceTask[];
  progress: ReturnType<typeof progressDisplay>;
}> {
  if (!isValidDateIso(date)) {
    return { tasks: [], progress: progressDisplay(0, 0) };
  }
  const rows = await loadTaskRows(userId);
  const defs = rows.map(asDef);
  const occurring = defs.filter((d) => occursOnDate(d, date));
  const completions = await sql<CompletionRow>(
    `select id, task_id, occurrence_date::text as occurrence_date, done
     from task_completions
     where user_id = $1 and occurrence_date = $2`,
    [userId, date],
  );
  const byTask = new Map(completions.map((c) => [c.task_id, c]));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const tasks: OccurrenceTask[] = occurring.map((def) => {
    const row = rowById.get(def.id)!;
    const completion = byTask.get(def.id);
    return {
      id: def.id,
      title: def.title,
      notes: def.notes,
      scheduleType: def.schedule_type,
      startDate: def.start_date,
      endDate: def.end_date,
      weekdays: def.weekdays,
      categoryId: def.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color,
      sortOrder: def.sort_order,
      occurrenceDate: date,
      done: completion ? !!completion.done : false,
      completionId: completion?.id ?? null,
    };
  });

  const completed = tasks.filter((t) => t.done).length;
  return { tasks, progress: progressDisplay(completed, tasks.length) };
}

export async function setOccurrenceDone(
  userId: string,
  taskId: string,
  date: string,
  done: boolean,
) {
  const owned = await sql<{ id: string }>(
    "select id from tasks where id = $1 and user_id = $2 limit 1",
    [taskId, userId],
  );
  if (owned.length === 0) return null;

  const existing = await sql<CompletionRow>(
    `select id, task_id, occurrence_date::text as occurrence_date, done
     from task_completions
     where task_id = $1 and occurrence_date = $2 limit 1`,
    [taskId, date],
  );

  if (existing.length > 0) {
    await sql(
      `update task_completions
       set done = $1, completed_at = case when $1 then now() else null end
       where id = $2`,
      [done, existing[0].id],
    );
    return existing[0].id;
  }

  if (!done) return null;
  const id = crypto.randomUUID();
  await sql(
    `insert into task_completions (id, task_id, user_id, occurrence_date, done, completed_at)
     values ($1, $2, $3, $4, true, now())`,
    [id, taskId, userId, date],
  );
  return id;
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    scheduleType: ScheduleType;
    startDate: string;
    endDate?: string | null;
    weekdays?: string;
    categoryId?: string | null;
    notes?: string;
  },
) {
  const id = crypto.randomUUID();
  const orderRows = await sql<{ max: number | null }>(
    "select max(sort_order) as max from tasks where user_id = $1",
    [userId],
  );
  const sortOrder = (orderRows[0]?.max ?? 0) + 1;
  const scheduleType = input.scheduleType || "once";
  const startDate = input.startDate;
  const endDate =
    scheduleType === "once"
      ? startDate
      : scheduleType === "range"
        ? input.endDate || startDate
        : input.endDate || null;

  const categoryId = await ownedCategoryId(userId, input.categoryId ?? null);

  await sql(
    `insert into tasks (
       id, user_id, task_date, title, done, sort_order,
       schedule_type, start_date, end_date, weekdays, category_id, notes, archived
     ) values ($1,$2,$3,$4,false,$5,$6,$7,$8,$9,$10,$11,false)`,
    [
      id,
      userId,
      startDate,
      input.title,
      sortOrder,
      scheduleType,
      startDate,
      endDate,
      input.weekdays || "",
      categoryId,
      input.notes || "",
    ],
  );
  return id;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: Partial<{
    title: string;
    scheduleType: ScheduleType;
    startDate: string;
    endDate: string | null;
    weekdays: string;
    categoryId: string | null;
    notes: string;
    archived: boolean;
  }>,
) {
  const rows = await sql<TaskRow>(
    `select t.id, t.title, t.schedule_type,
            t.start_date::text as start_date, t.end_date::text as end_date,
            t.weekdays, t.category_id, t.notes, t.archived, t.sort_order,
            null as category_name, null as category_color
     from tasks t where t.id = $1 and t.user_id = $2`,
    [taskId, userId],
  );
  if (rows.length === 0) return false;
  const cur = rows[0];
  const title = input.title ?? cur.title;
  const scheduleType = (input.scheduleType ?? cur.schedule_type) as ScheduleType;
  const startDate = input.startDate ?? String(cur.start_date).slice(0, 10);
  let endDate =
    input.endDate !== undefined
      ? input.endDate
      : cur.end_date
        ? String(cur.end_date).slice(0, 10)
        : null;
  if (scheduleType === "once") endDate = startDate;
  const weekdays = input.weekdays ?? cur.weekdays;
  const categoryId =
    input.categoryId !== undefined
      ? await ownedCategoryId(userId, input.categoryId)
      : cur.category_id;
  const notes = input.notes ?? cur.notes;
  const archived = input.archived ?? cur.archived;

  await sql(
    `update tasks set
       title = $1, schedule_type = $2, start_date = $3, end_date = $4,
       weekdays = $5, category_id = $6, notes = $7, archived = $8,
       task_date = $3, updated_at = now()
     where id = $9 and user_id = $10`,
    [
      title,
      scheduleType,
      startDate,
      endDate,
      weekdays,
      categoryId,
      notes,
      archived,
      taskId,
      userId,
    ],
  );
  return true;
}

export async function deleteTask(userId: string, taskId: string) {
  await sql("delete from tasks where id = $1 and user_id = $2", [taskId, userId]);
}

export async function calendarMonth(userId: string, monthIso: string) {
  const start = `${monthIso.slice(0, 7)}-01`;
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${start.slice(0, 7)}-${String(last).padStart(2, "0")}`;
  const rows = await loadTaskRows(userId);
  const defs = rows.map(asDef);
  const completions = await sql<CompletionRow>(
    `select id, task_id, occurrence_date::text as occurrence_date, done
     from task_completions
     where user_id = $1 and occurrence_date >= $2 and occurrence_date <= $3`,
    [userId, start, end],
  );
  const doneByDate = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!c.done) continue;
    const key = String(c.occurrence_date).slice(0, 10);
    if (!doneByDate.has(key)) doneByDate.set(key, new Set());
    doneByDate.get(key)!.add(c.task_id);
  }
  const days = [];
  for (let d = 1; d <= last; d++) {
    const iso = `${start.slice(0, 7)}-${String(d).padStart(2, "0")}`;
    const occurring = defs.filter((def) => occursOnDate(def, iso));
    const doneSet = doneByDate.get(iso) ?? new Set();
    const total = occurring.length;
    const completed = occurring.filter((t) => doneSet.has(t.id)).length;
    days.push({ date: iso, ...progressDisplay(completed, total), total, completed });
  }
  return days;
}
