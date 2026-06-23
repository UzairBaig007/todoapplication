"use client";

import { useEffect, useState } from "react";
import type { Todo } from "@/app/generated/prisma/client";
import { TODO_PRIORITIES, PRIORITY_LABELS, type TodoPriority } from "@/lib/todo";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

type EditTodoModalProps = {
  open: boolean;
  todo: Todo;
  onSave: (
    title: string,
    note: string,
    priority: TodoPriority,
    setError: (message: string | null) => void,
  ) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

export function EditTodoModal({
  open,
  todo,
  onSave,
  onCancel,
  isSaving = false,
}: EditTodoModalProps) {
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note ?? "");
  const [priority, setPriority] = useState<TodoPriority>(
    (todo.priority as TodoPriority) ?? "medium",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(todo.title);
      setNote(todo.note ?? "");
      setPriority((todo.priority as TodoPriority) ?? "medium");
      setError(null);
    }
  }, [open, todo]);

  if (!open) return null;

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title cannot be empty");
      return;
    }
    setError(null);
    onSave(trimmedTitle, note, priority, setError);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      data-testid="edit-modal"
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <h2
          id="edit-modal-title"
          className="text-sm font-semibold text-foreground"
        >
          Edit task
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="edit-title" className="mb-1 block text-xs text-zinc-500">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="edit-title-input"
              className={inputClassName}
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="edit-note" className="mb-1 block text-xs text-zinc-500">
              Note (optional)
            </label>
            <textarea
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              data-testid="edit-note-input"
              className={`resize-none ${inputClassName}`}
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="edit-priority" className="mb-1 block text-xs text-zinc-500">
              Priority
            </label>
            <select
              id="edit-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              data-testid="edit-priority-select"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={isSaving}
            >
              {TODO_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            data-testid="edit-modal-cancel"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="edit-modal-save"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
