export const TASHKENT_TZ = "Asia/Tashkent";

const WEEKDAYS_UZ = [
  "yakshanba",
  "dushanba",
  "seshanba",
  "chorshanba",
  "payshanba",
  "juma",
  "shanba",
];

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export function isValidDateIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's calendar date in Asia/Tashkent as YYYY-MM-DD. */
export function todayIso(_timeZoneOffsetMinutes?: number) {
  return formatIsoInZone(new Date(), TASHKENT_TZ);
}

export function formatIsoInZone(date: Date, timeZone = TASHKENT_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addDaysIso(iso: string, delta: number) {
  const { y, m, d } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function weekdayIndexUtc(iso: string) {
  const { y, m, d } = parseIsoDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function describeUzbekDate(iso: string) {
  const { y, m, d } = parseIsoDate(iso);
  const weekday = WEEKDAYS_UZ[weekdayIndexUtc(iso)];
  const month = MONTHS_UZ[m - 1];
  return {
    iso,
    weekday,
    weekdayTitle: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day: d,
    month,
    monthTitle: month.charAt(0).toUpperCase() + month.slice(1),
    monthIndex: m,
    year: y,
    label: `${WEEKDAYS_UZ[weekdayIndexUtc(iso)].charAt(0).toUpperCase()}${WEEKDAYS_UZ[weekdayIndexUtc(iso)].slice(1)}, ${d}-${month} ${y}`,
    shortLabel: `${d} ${month} ${y}`,
  };
}

export function startOfWeekIso(iso: string) {
  // Monday-start week (Uzbek common work week)
  const dow = weekdayIndexUtc(iso); // 0 Sun .. 6 Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(iso, offset);
}

export function endOfWeekIso(iso: string) {
  return addDaysIso(startOfWeekIso(iso), 6);
}

export function startOfMonthIso(iso: string) {
  const { y, m } = parseIsoDate(iso);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function endOfMonthIso(iso: string) {
  const { y, m } = parseIsoDate(iso);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function addMonthsIso(iso: string, delta: number) {
  const { y, m, d } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonthGrid(year: number, month: number) {
  // month 1-12; returns ISO dates for Mon-start calendar cells (null for empty)
  const firstIso = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstDow = weekdayIndexUtc(firstIso);
  const leading = firstDow === 0 ? 6 : firstDow - 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthTitleUz(year: number, month: number) {
  const name = MONTHS_UZ[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
