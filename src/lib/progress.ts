export type ProgressTone = "neutral" | "low" | "mid" | "high";

export function progressTone(completed: number, total: number): ProgressTone {
  if (total <= 0) return "neutral";
  const percent = Math.round((completed / total) * 100);
  if (percent < 50) return "low";
  if (percent < 80) return "mid";
  return "high";
}

export function progressPercent(completed: number, total: number) {
  if (total <= 0) return null;
  return Math.round((completed / total) * 100);
}

export function progressDisplay(completed: number, total: number) {
  const percent = progressPercent(completed, total);
  return {
    completed,
    total,
    percent,
    tone: progressTone(completed, total),
    label: percent === null ? "—" : `${percent}%`,
  };
}
