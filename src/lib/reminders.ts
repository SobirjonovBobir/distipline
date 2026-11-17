import { sql } from "./db";
import { tasksForDate } from "./tasks";

export async function maybeCreateIncompleteReminder(userId: string, taskDate: string) {
  const { tasks, progress } = await tasksForDate(userId, taskDate);
  if (progress.total === 0) return null;
  if (progress.percent === 100) return null;

  const recent = await sql<{ id: string }>(
    `select id from reminders
     where user_id = $1 and kind = 'incomplete' and created_at > now() - interval '4 hours'
     limit 1`,
    [userId],
  );
  if (recent.length > 0) return null;

  const incomplete = tasks.filter((t) => !t.done);
  const sample = incomplete
    .slice(0, 3)
    .map((t) => t.title)
    .join(", ");
  const more = incomplete.length > 3 ? ` va yana ${incomplete.length - 3} ta` : "";
  const pct = progress.label;
  const body = `Bugun ${pct} bajarildi. Qolgan: ${sample}${more}.`;

  const id = crypto.randomUUID();
  await sql(
    `insert into reminders (id, user_id, body, kind) values ($1, $2, $3, 'incomplete')`,
    [id, userId, body],
  );
  return { id, body, kind: "incomplete" as const, read: false };
}
