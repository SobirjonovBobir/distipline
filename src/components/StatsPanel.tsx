"use client";

type Period = {
  completed: number;
  total: number;
  percent: number | null;
  tone?: string;
  label?: string;
  daysWithTasks?: number;
};
type TrendPoint = {
  date: string;
  completed: number;
  total: number;
  percent: number | null;
  tone?: string;
  label?: string;
};

type Props = {
  day: Period;
  week: Period;
  month: Period;
  trend: TrendPoint[];
  trendDelta: number | null;
  streak?: number;
  ranges: {
    week: { start: string; end: string };
    month: { start: string; end: string };
  };
};

function Row({ label, hint, period }: { label: string; hint: string; period: Period }) {
  const tone = period.tone || (period.total <= 0 ? "neutral" : "low");
  const shown = period.label ?? (period.percent === null ? "—" : `${period.percent}%`);
  return (
    <div className="stats-row">
      <div className="stats-row-copy">
        <p className="stats-row-label">{label}</p>
        <p className="stats-row-hint">{hint}</p>
      </div>
      <div className="stats-row-metrics">
        <p className={`stats-row-percent tone-${tone}`}>{shown}</p>
        <p className="stats-row-frac">
          {period.completed}/{period.total}
        </p>
      </div>
      <div className="stats-mini-track" aria-hidden="true">
        <div
          className={`stats-mini-fill tone-${tone}`}
          style={{ width: `${period.percent ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function StatsPanel({ day, week, month, trend, trendDelta, streak = 0, ranges }: Props) {
  const maxPct = Math.max(1, ...trend.map((t) => t.percent ?? 0));
  const deltaText =
    trendDelta === null
      ? "Trend uchun yetarli ma’lumot yo‘q"
      : trendDelta > 0
        ? `So‘nggi 7 kunda +${trendDelta} punkt`
        : trendDelta < 0
          ? `So‘nggi 7 kunda ${trendDelta} punkt`
          : "So‘nggi 7 kunda o‘zgarish yo‘q";

  return (
    <section className="stats-surface" aria-label="Statistika">
      {streak > 0 ? (
        <div className="streak-banner">
          <div>
            <p className="progress-label">Ketma-ket mukammal kunlar</p>
            <strong>{streak} kun</strong>
          </div>
          <p className="progress-label">100% bajarilgan kunlar zanjiri</p>
        </div>
      ) : null}

      <div className="stats-head">
        <h2>Natijalar</h2>
        <p>{deltaText}</p>
      </div>

      <div className="stats-stack">
        <Row label="Kun" hint="Tanlangan sana" period={day} />
        <Row label="Hafta" hint={`${ranges.week.start.slice(5)} — ${ranges.week.end.slice(5)}`} period={week} />
        <Row
          label="Oy"
          hint={`${ranges.month.start.slice(0, 7)} · ${month.daysWithTasks ?? 0} kun vazifa bor`}
          period={month}
        />
      </div>

      <div className="stats-trend" aria-label="7 kunlik trend">
        <p className="stats-trend-label">7 kunlik foiz</p>
        <div className="stats-bars">
          {trend.map((point) => {
            const tone = point.tone || (point.total <= 0 ? "neutral" : "low");
            const h = point.percent === null ? 0 : Math.round((point.percent / maxPct) * 100);
            return (
              <div key={point.date} className="stats-bar-col" title={`${point.date}: ${point.label ?? "—"}`}>
                <div className="stats-bar-track">
                  <div className={`stats-bar-fill tone-${tone}`} style={{ height: `${h}%` }} />
                </div>
                <span>{Number(point.date.slice(-2))}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
