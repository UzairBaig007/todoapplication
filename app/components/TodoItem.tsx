"use client";

import { useState, useTransition } from "react";
import {
  deleteTodo,
  updateTodo,
  updateTodoStatus,
} from "@/app/actions";
import type { Todo } from "@/app/generated/prisma/client";
import {
  getTitleStyles,
  getTodoItemStyles,
  STATUS_LABELS,
  TODO_STATUSES,
  type TodoStatus,
} from "@/lib/todo";
import { ConfirmModal } from "./ConfirmModal";
import { EditTodoModal } from "./EditTodoModal";

export function TodoItem({ todo }: { todo: Todo }) {
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const status = todo.status as TodoStatus;

  function handleStatusChange(newStatus: TodoStatus) {
    if (newStatus === status) return;

    if (newStatus === "done" && status !== "done") {
      setShowCompleteConfirm(true);
      return;
    }

    startTransition(() => {
      void updateTodoStatus(todo.id, newStatus);
    });
  }

  function handleCompleteConfirm() {
    setShowCompleteConfirm(false);
    startTransition(() => {
      void updateTodoStatus(todo.id, "done");
    });
  }

  function handleDeleteConfirm() {
    setShowDeleteConfirm(false);
    startTransition(() => {
      void deleteTodo(todo.id);
    });
  }

  function handleEditSave(
    title: string,
    note: string,
    setError: (message: string | null) => void,
  ) {
    startTransition(async () => {
      const result = await updateTodo(todo.id, title, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowEditModal(false);
    });
  }

  return (
    <>
      <li
        data-testid="todo-item"
        data-todo-title={todo.title}
        className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start ${getTodoItemStyles(status)}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) =>
                handleStatusChange(e.target.value as TodoStatus)
              }
              disabled={isPending}
              aria-label="Task status"
              data-testid="todo-status-select"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
            >
              {TODO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <span
            data-testid="todo-item-title"
            className={`mt-2 block text-sm ${getTitleStyles(status)}`}
          >
            {todo.title}
          </span>
          {todo.note && (
            <p
              data-testid="todo-item-note"
              className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
            >
              {todo.note}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1 sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            disabled={isPending}
            data-testid="todo-edit-button"
            className="rounded px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
            data-testid="todo-delete-button"
            className="rounded px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </li>

      <ConfirmModal
        open={showCompleteConfirm}
        message="Are you sure you want to mark this task as completed?"
        onConfirm={handleCompleteConfirm}
        onCancel={() => setShowCompleteConfirm(false)}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        message="Are you sure you want to delete this task?"
        confirmLabel="Yes (Delete)"
        cancelLabel="No"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <EditTodoModal
        open={showEditModal}
        todo={todo}
        isSaving={isPending}
        onSave={handleEditSave}
        onCancel={() => setShowEditModal(false)}
      />
    </>
  );
}
