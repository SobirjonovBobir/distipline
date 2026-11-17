"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ScheduleType } from "@/lib/schedule";

export type Category = { id: string; name: string; color: string };
export type TaskDraft = {
  title: string;
  scheduleType: ScheduleType;
  startDate: string;
  endDate: string;
  weekdays: string;
  categoryId: string;
  notes: string;
};

const WEEKDAY_OPTS = [
  { v: 1, l: "Du" },
  { v: 2, l: "Se" },
  { v: 3, l: "Ch" },
  { v: 4, l: "Pa" },
  { v: 5, l: "Ju" },
  { v: 6, l: "Sh" },
  { v: 7, l: "Ya" },
];

type Props = {
  initial: TaskDraft;
  categories: Category[];
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void> | void;
  onCancel?: () => void;
};

export function TaskForm({ initial, categories, submitLabel, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => new Set(draft.weekdays.split(",").filter(Boolean).map(Number)),
    [draft.weekdays],
  );

  function toggleDay(day: number) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setDraft((d) => ({
      ...d,
      weekdays: [...next].sort((a, b) => a - b).join(","),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        ...draft,
        title: draft.title.trim(),
        notes: draft.notes.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: "0.85rem" }}>
      <div className="field">
        <label>Vazifa</label>
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Masalan: Ertalab yugurish"
          maxLength={200}
          required
        />
      </div>
      <div className="field">
        <label>Rejim</label>
        <select
          value={draft.scheduleType}
          onChange={(e) =>
            setDraft((d) => ({ ...d, scheduleType: e.target.value as ScheduleType }))
          }
        >
          <option value="once">Bir martalik</option>
          <option value="daily">Har kuni</option>
          <option value="weekly">Har hafta</option>
          <option value="monthly">Har oy</option>
          <option value="range">Sana oralig‘i</option>
        </select>
      </div>
      <div className="field">
        <label>Boshlanish</label>
        <input
          type="date"
          value={draft.startDate}
          onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
          required
        />
      </div>
      {(draft.scheduleType === "range" ||
        draft.scheduleType === "daily" ||
        draft.scheduleType === "weekly" ||
        draft.scheduleType === "monthly") && (
        <div className="field">
          <label>Tugash {draft.scheduleType === "range" ? "(majburiy)" : "(ixtiyoriy)"}</label>
          <input
            type="date"
            value={draft.endDate}
            onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
            required={draft.scheduleType === "range"}
          />
        </div>
      )}
      {draft.scheduleType === "weekly" ? (
        <div className="field">
          <label>Hafta kunlari</label>
          <div className="weekdays">
            {WEEKDAY_OPTS.map((d) => (
              <button
                key={d.v}
                type="button"
                className={`weekday-chip${selected.has(d.v) ? " on" : ""}`}
                onClick={() => toggleDay(d.v)}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="field">
        <label>Kategoriya</label>
        <select
          value={draft.categoryId}
          onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
        >
          <option value="">Kategoriyasiz</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Izoh</label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Qisqa eslatma…"
          maxLength={1000}
        />
      </div>
      <div className="composer-actions">
        <button className="btn btn-primary" type="submit" disabled={busy || !draft.title.trim()}>
          {busy ? "Saqlanmoqda…" : submitLabel}
        </button>
        {onCancel ? (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Bekor
          </button>
        ) : null}
      </div>
    </form>
  );
}
