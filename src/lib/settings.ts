import { sql } from "./db";
import { normalizeLocale } from "./i18n";

export type UserSettings = {
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

export const SETTINGS_DEFAULTS: UserSettings = {
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

type Row = {
  theme: string;
  density: string;
  week_starts_on: number;
  focus_work_minutes: number;
  focus_break_minutes: number;
  locale: string;
  timezone: string;
  notify_incomplete?: boolean;
  notify_focus?: boolean;
  notify_journal?: boolean;
  default_priority?: string;
};

function mapRow(r: Row): UserSettings {
  return {
    theme: r.theme || SETTINGS_DEFAULTS.theme,
    density: r.density || SETTINGS_DEFAULTS.density,
    weekStartsOn: Number(r.week_starts_on) || 1,
    focusWorkMinutes: Number(r.focus_work_minutes) || 25,
    focusBreakMinutes: Number(r.focus_break_minutes) || 5,
    locale: normalizeLocale(r.locale),
    timezone: r.timezone || "Asia/Tashkent",
    notifyIncomplete: r.notify_incomplete !== false,
    notifyFocus: r.notify_focus !== false,
    notifyJournal: !!r.notify_journal,
    defaultPriority: r.default_priority || "normal",
  };
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const rows = await sql<Row>("select * from user_settings where user_id = $1 limit 1", [userId]);
  if (rows.length === 0) {
    try {
      await sql(
        `insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing`,
        [userId],
      );
    } catch {
      // user row must exist; return defaults without failing the page
    }
    const again = await sql<Row>("select * from user_settings where user_id = $1 limit 1", [userId]);
    if (again.length > 0) return mapRow(again[0]);
    return { ...SETTINGS_DEFAULTS };
  }
  return mapRow(rows[0]);
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>) {
  const cur = await getSettings(userId);
  const next = { ...cur, ...patch, locale: normalizeLocale(patch.locale ?? cur.locale) };
  await sql(
    `insert into user_settings (
       user_id, theme, density, week_starts_on, focus_work_minutes, focus_break_minutes,
       locale, timezone, notify_incomplete, notify_focus, notify_journal, default_priority, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
     on conflict (user_id) do update set
       theme = excluded.theme,
       density = excluded.density,
       week_starts_on = excluded.week_starts_on,
       focus_work_minutes = excluded.focus_work_minutes,
       focus_break_minutes = excluded.focus_break_minutes,
       locale = excluded.locale,
       timezone = excluded.timezone,
       notify_incomplete = excluded.notify_incomplete,
       notify_focus = excluded.notify_focus,
       notify_journal = excluded.notify_journal,
       default_priority = excluded.default_priority,
       updated_at = now()`,
    [
      userId,
      next.theme,
      next.density,
      next.weekStartsOn,
      next.focusWorkMinutes,
      next.focusBreakMinutes,
      next.locale,
      next.timezone,
      next.notifyIncomplete,
      next.notifyFocus,
      next.notifyJournal,
      next.defaultPriority,
    ],
  );
  return next;
}
