"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createTodo } from "@/app/actions";
import { TODO_PRIORITIES, PRIORITY_LABELS } from "@/lib/todo";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="todo-add-button"
      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

export function TodoForm() {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createTodo(formData);
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      data-testid="todo-form"
      className="flex w-full flex-col gap-3"
    >
      <div className="flex gap-2">
        <input
          type="text"
          name="title"
          placeholder="What needs to be done?"
          required
          data-testid="todo-title-input"
          className={`flex-1 ${inputClassName}`}
        />
        <SubmitButton />
      </div>
      <textarea
        name="note"
        placeholder="Note (optional)"
        rows={2}
        data-testid="todo-note-input"
        className={`resize-none ${inputClassName}`}
      />
      <div>
        <label htmlFor="todo-priority" className="mb-1 block text-xs text-zinc-500">
          Priority
        </label>
        <select
          id="todo-priority"
          name="priority"
          defaultValue="medium"
          data-testid="todo-priority-select"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {TODO_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
