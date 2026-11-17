import {
  addDaysIso,
  addMonthsIso,
  endOfMonthIso,
  isValidDateIso,
  parseIsoDate,
  startOfMonthIso,
  weekdayIndexUtc,
} from "./dates";

export type ScheduleType = "once" | "daily" | "weekly" | "monthly" | "range";

export type TaskDefinition = {
  id: string;
  title: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string | null;
  weekdays: string;
  category_id: string | null;
  notes: string;
  archived: boolean;
  sort_order: number;
  created_at?: string;
};

/** Monday=1 … Sunday=7 */
export function weekdayMon1(iso: string) {
  const sun0 = weekdayIndexUtc(iso);
  return sun0 === 0 ? 7 : sun0;
}

export function parseWeekdays(raw: string): number[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => n >= 1 && n <= 7);
}

export function occursOnDate(task: TaskDefinition, date: string): boolean {
  if (!isValidDateIso(date)) return false;
  if (task.archived) return false;
  const start = task.start_date?.slice(0, 10);
  if (!start || !isValidDateIso(start)) return false;
  if (date < start) return false;
  const end = task.end_date?.slice(0, 10) || null;
  if (end && date > end) return false;

  switch (task.schedule_type) {
    case "once":
      return date === start;
    case "daily":
      return true;
    case "range":
      return true;
    case "weekly": {
      const days = parseWeekdays(task.weekdays);
      if (days.length === 0) return weekdayMon1(date) === weekdayMon1(start);
      return days.includes(weekdayMon1(date));
    }
    case "monthly": {
      const { d: startDay } = parseIsoDate(start);
      const { d } = parseIsoDate(date);
      const last = Number(endOfMonthIso(date).slice(-2));
      const target = Math.min(startDay, last);
      return d === target;
    }
    default:
      return false;
  }
}

export function expandOccurrences(
  task: TaskDefinition,
  from: string,
  to: string,
): string[] {
  if (!isValidDateIso(from) || !isValidDateIso(to) || from > to) return [];
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (occursOnDate(task, cursor)) out.push(cursor);
    cursor = addDaysIso(cursor, 1);
    if (out.length > 400) break;
  }
  return out;
}

export function scheduleLabelUz(task: TaskDefinition): string {
  switch (task.schedule_type) {
    case "once":
      return "Bir martalik";
    case "daily":
      return "Har kuni";
    case "weekly":
      return "Har hafta";
    case "monthly":
      return "Har oy";
    case "range":
      return "Oraliq";
    default:
      return "Vazifa";
  }
}

export function nextMonthSameDay(iso: string) {
  return addMonthsIso(iso, 1);
}

export function monthWindow(iso: string) {
  return { start: startOfMonthIso(iso), end: endOfMonthIso(iso) };
}
