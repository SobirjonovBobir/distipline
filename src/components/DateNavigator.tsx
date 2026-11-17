"use client";

import { useMemo, useState } from "react";
import {
  addMonthsIso,
  daysInMonthGrid,
  describeUzbekDate,
  monthTitleUz,
  parseIsoDate,
  todayIso,
} from "@/lib/dates";

type DayMeta = {
  date: string;
  tone?: string;
  total?: number;
  completed?: number;
  percent?: number | null;
  label?: string;
};

type Props = {
  date: string;
  onChange: (iso: string) => void;
  dayMeta?: DayMeta[];
};

const DOW = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

export function DateNavigator({ date, onChange, dayMeta = [] }: Props) {
  const today = todayIso();
  const info = describeUzbekDate(date);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(date);
  const metaMap = useMemo(() => new Map(dayMeta.map((d) => [d.date, d])), [dayMeta]);

  const { y, m } = parseIsoDate(cursor);
  const cells = useMemo(() => daysInMonthGrid(y, m), [y, m]);

  function shiftDay(delta: number) {
    const { y: yy, m: mm, d } = parseIsoDate(date);
    const dt = new Date(Date.UTC(yy, mm - 1, d + delta));
    const next = [
      dt.getUTCFullYear(),
      String(dt.getUTCMonth() + 1).padStart(2, "0"),
      String(dt.getUTCDate()).padStart(2, "0"),
    ].join("-");
    onChange(next);
    setCursor(next);
  }

  function pick(iso: string) {
    onChange(iso);
    setCursor(iso);
    setOpen(false);
  }

  return (
    <section className="date-nav" aria-label="Sana tanlash">
      <div className="date-nav-row">
        <button className="icon-btn date-shift" type="button" aria-label="Oldingi kun" onClick={() => shiftDay(-1)}>
          ‹
        </button>
        <button
          className="date-display"
          type="button"
          onClick={() => {
            setCursor(date);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
        >
          <span className="date-weekday">{info.weekdayTitle}</span>
          <span className="date-main">
            <span className="date-day">{info.day}</span>
            <span className="date-month-year">
              {info.monthTitle} {info.year}
            </span>
          </span>
          {date === today ? (
            <span className="date-today-pill">Bugun · Toshkent</span>
          ) : (
            <span className="date-today-pill muted">Toshkent vaqti</span>
          )}
        </button>
        <button className="icon-btn date-shift" type="button" aria-label="Keyingi kun" onClick={() => shiftDay(1)}>
          ›
        </button>
      </div>

      {open ? (
        <div className="calendar-panel">
          <div className="calendar-head">
            <button className="btn btn-ghost" type="button" onClick={() => setCursor(addMonthsIso(cursor, -1))}>
              ‹
            </button>
            <p className="calendar-title">{monthTitleUz(y, m)}</p>
            <button className="btn btn-ghost" type="button" onClick={() => setCursor(addMonthsIso(cursor, 1))}>
              ›
            </button>
          </div>
          <div className="calendar-year-row">
            <button className="btn btn-ghost" type="button" onClick={() => setCursor(addMonthsIso(cursor, -12))}>
              −yil
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => pick(today)}>
              Bugunga
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setCursor(addMonthsIso(cursor, 12))}>
              +yil
            </button>
          </div>
          <div className="calendar-dow">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid calendar-grid-rich">
            {cells.map((cell, idx) => {
              if (!cell) return <span key={`e-${idx}`} className="calendar-empty" />;
              const meta = metaMap.get(cell);
              const total = meta?.total ?? 0;
              const label =
                total > 0
                  ? meta?.percent != null
                    ? `${meta.percent}%`
                    : `${meta?.completed ?? 0}/${total}`
                  : null;
              return (
                <button
                  key={cell}
                  type="button"
                  className={`calendar-day rich${cell === date ? " selected" : ""}${cell === today ? " is-today" : ""}${
                    meta?.tone ? ` tone-${meta.tone}` : ""
                  }`}
                  onClick={() => pick(cell)}
                  title={total > 0 ? `${cell}: ${meta?.completed ?? 0}/${total}` : cell}
                >
                  <span className="cal-num">{Number(cell.slice(-2))}</span>
                  {label ? <span className="cal-pct">{label}</span> : <span className="cal-pct muted-dot">·</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
