"use client";

import { useEffect } from "react";
import { TaskForm, type Category, type TaskDraft } from "./TaskForm";

type Props = {
  open: boolean;
  title: string;
  initial: TaskDraft;
  categories: Category[];
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void> | void;
  onClose: () => void;
};

export function TaskSheet({
  open,
  title,
  initial,
  categories,
  submitLabel,
  onSubmit,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" type="button" aria-label="Yopish" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>
        <TaskForm
          key={`${initial.title}-${initial.startDate}-${submitLabel}`}
          initial={initial}
          categories={categories}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
