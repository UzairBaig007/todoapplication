# Priority Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Low / Medium / High priority to todos — set on creation, editable, displayed as a badge, filterable, and sortable.

**Architecture:** Extend the Prisma schema with a `Priority` enum and migrate; add priority constants/helpers to `lib/todo.ts`; thread priority through the two existing server actions (`createTodo`, `updateTodo`); update `TodoForm`, `EditTodoModal`, `TodoItem`, and `FilterableTodoList` to expose priority in the UI; add Playwright tests and extend the `TodoPage` helper.

**Tech Stack:** Next.js (App Router), Prisma (SQLite), Tailwind CSS, Playwright (E2E tests)

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `Priority` enum + `priority` field on `Todo` |
| `lib/todo.ts` | Add priority constants, types, helpers |
| `app/actions.ts` | Thread `priority` through `createTodo` and `updateTodo` |
| `app/components/TodoForm.tsx` | Add priority `<select>` |
| `app/components/EditTodoModal.tsx` | Add priority state + `<select>` |
| `app/components/TodoItem.tsx` | Render priority badge; pass priority to edit save |
| `app/components/FilterableTodoList.tsx` | Priority filter pills + sort dropdown |
| `tests/helpers/todo-page.ts` | Add priority helper methods |
| `tests/specs/priority.spec.ts` | New spec file for priority E2E tests |

---

## Task 1: Extend Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the Priority enum and field**

Open `prisma/schema.prisma` and make it look like this (full file):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum TodoStatus {
  pending
  in_progress
  done
}

enum Priority {
  low
  medium
  high
}

model User {
  id        Int        @id @default(autoincrement())
  email     String     @unique
  password  String
  createdAt DateTime   @default(now())
  todos     Todo[]
}

model Todo {
  id        Int        @id @default(autoincrement())
  title     String
  note      String?
  status    TodoStatus @default(pending)
  priority  Priority   @default(medium)
  createdAt DateTime   @default(now())
  userId    Int
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-priority
```

Expected output: `Your database is now in sync with your schema.`

Also run it against the test database:

```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected output: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Priority enum to Todo schema"
```

---

## Task 2: Add priority helpers to `lib/todo.ts`

**Files:**
- Modify: `lib/todo.ts`

- [ ] **Step 1: Add constants, type, labels, type guard, and badge style helper**

Replace the full contents of `lib/todo.ts` with:

```ts
export const TODO_STATUSES = ["pending", "in_progress", "done"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export const STATUS_LABELS: Record<TodoStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

export function isTodoStatus(value: string): value is TodoStatus {
  return TODO_STATUSES.includes(value as TodoStatus);
}

export function getTodoItemStyles(status: TodoStatus): string {
  switch (status) {
    case "pending":
      return "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
    case "in_progress":
      return "border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/20";
    case "done":
      return "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20";
  }
}

export function getTitleStyles(status: TodoStatus): string {
  if (status === "done") {
    return "text-zinc-400 line-through";
  }
  if (status === "in_progress") {
    return "text-amber-950 dark:text-amber-100";
  }
  return "text-foreground";
}

export const TODO_PRIORITIES = ["low", "medium", "high"] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function isPriority(value: string): value is TodoPriority {
  return TODO_PRIORITIES.includes(value as TodoPriority);
}

export function getPriorityBadgeStyles(priority: TodoPriority): string {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/todo.ts
git commit -m "feat: add priority helpers to lib/todo.ts"
```

---

## Task 3: Thread priority through server actions

**Files:**
- Modify: `app/actions.ts`

- [ ] **Step 1: Update `createTodo` and `updateTodo`**

Replace the full contents of `app/actions.ts` with:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { isTodoStatus, isPriority, type TodoStatus, type TodoPriority } from '@/lib/todo'

export async function createTodo(formData: FormData) {
  const { userId } = await verifySession()
  const title = formData.get('title')?.toString().trim()
  if (!title) return

  const note = formData.get('note')?.toString().trim() || null
  const rawPriority = formData.get('priority')?.toString() ?? ''
  const priority: TodoPriority = isPriority(rawPriority) ? rawPriority : 'medium'

  await prisma.todo.create({
    data: { title, note, priority, userId },
  })
  revalidatePath('/')
}

export async function updateTodoStatus(id: number, status: string) {
  const { userId } = await verifySession()
  if (!isTodoStatus(status)) return

  await prisma.todo.update({
    where: { id, userId },
    data: { status: status as TodoStatus },
  })
  revalidatePath('/')
}

export async function updateTodo(
  id: number,
  title: string,
  note: string | null,
  priority: TodoPriority,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession()
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return { ok: false, error: 'Title cannot be empty' }
  }

  const trimmedNote = note?.trim() || null

  await prisma.todo.update({
    where: { id, userId },
    data: { title: trimmedTitle, note: trimmedNote, priority },
  })
  revalidatePath('/')
  return { ok: true }
}

export async function deleteTodo(id: number) {
  const { userId } = await verifySession()
  await prisma.todo.delete({ where: { id, userId } })
  revalidatePath('/')
}

export async function clearCompletedTodos() {
  const { userId } = await verifySession()
  await prisma.todo.deleteMany({
    where: { status: 'done', userId },
  })
  revalidatePath('/')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (there will be type errors in `TodoItem` because `updateTodo` signature changed — that's expected and will be fixed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add app/actions.ts
git commit -m "feat: thread priority through createTodo and updateTodo actions"
```

---

## Task 4: Add priority select to `TodoForm`

**Files:**
- Modify: `app/components/TodoForm.tsx`

- [ ] **Step 1: Add the priority select**

Replace the full contents of `app/components/TodoForm.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add app/components/TodoForm.tsx
git commit -m "feat: add priority select to TodoForm"
```

---

## Task 5: Update `EditTodoModal` and `TodoItem` for priority

**Files:**
- Modify: `app/components/EditTodoModal.tsx`
- Modify: `app/components/TodoItem.tsx`

- [ ] **Step 1: Update `EditTodoModal` to include priority**

Replace the full contents of `app/components/EditTodoModal.tsx` with:

```tsx
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
```

- [ ] **Step 2: Update `TodoItem` to render the badge and pass priority to edit**

Replace the full contents of `app/components/TodoItem.tsx` with:

```tsx
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
  getPriorityBadgeStyles,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TODO_STATUSES,
  type TodoPriority,
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
  const priority = (todo.priority as TodoPriority) ?? "medium";

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
    newPriority: TodoPriority,
    setError: (message: string | null) => void,
  ) {
    startTransition(async () => {
      const result = await updateTodo(todo.id, title, note, newPriority);
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

          <span
            data-testid="todo-priority-badge"
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityBadgeStyles(priority)}`}
          >
            {PRIORITY_LABELS[priority]}
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
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/EditTodoModal.tsx app/components/TodoItem.tsx
git commit -m "feat: add priority badge to TodoItem and priority field to EditTodoModal"
```

---

## Task 6: Add priority filter pills and sort dropdown to `FilterableTodoList`

**Files:**
- Modify: `app/components/FilterableTodoList.tsx`

- [ ] **Step 1: Replace `FilterableTodoList` with priority filter + sort support**

Replace the full contents of `app/components/FilterableTodoList.tsx` with:

```tsx
"use client";

import { useState } from "react";
import type { Todo } from "@/app/generated/prisma/client";
import {
  type TodoStatus,
  type TodoPriority,
  TODO_PRIORITIES,
  PRIORITY_LABELS,
} from "@/lib/todo";
import { TodoItem } from "./TodoItem";

type FilterValue = TodoStatus | "all";
type SortOrder = "none" | "high-first" | "low-first";

const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Completed" },
];

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

const pillBase =
  "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800";
const pillActive =
  "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background";

export function FilterableTodoList({ todos }: { todos: Todo[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [priorityFilter, setPriorityFilter] = useState<Set<TodoPriority>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");

  function togglePriorityFilter(p: TodoPriority) {
    setPriorityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  let filtered = todos.filter((todo) => {
    const matchesStatus = filter === "all" || todo.status === filter;
    const matchesPriority =
      priorityFilter.size === 0 || priorityFilter.has(todo.priority as TodoPriority);
    const q = search.toLowerCase();
    const matchesSearch =
      q === "" ||
      todo.title.toLowerCase().includes(q) ||
      (todo.note ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesPriority && matchesSearch;
  });

  if (sortOrder !== "none") {
    filtered = [...filtered].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority as TodoPriority] ?? 1;
      const pb = PRIORITY_ORDER[b.priority as TodoPriority] ?? 1;
      return sortOrder === "high-first" ? pa - pb : pb - pa;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          data-testid="search-input"
          className={inputClassName}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            data-testid="search-clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            data-testid={`filter-${value}`}
            className={filter === value ? pillActive : pillBase}
          >
            {label}
          </button>
        ))}

        <span className="h-4 w-px bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />

        {TODO_PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePriorityFilter(p)}
            data-testid={`priority-filter-${p}`}
            aria-pressed={priorityFilter.has(p)}
            className={priorityFilter.has(p) ? pillActive : pillBase}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="sort-order" className="text-xs text-zinc-500">
          Sort by:
        </label>
        <select
          id="sort-order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          data-testid="priority-sort-select"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="none">Default</option>
          <option value="high-first">Priority ↑ (High first)</option>
          <option value="low-first">Priority ↓ (Low first)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No tasks match your search.
        </p>
      ) : (
        <ul data-testid="todo-list" className="flex flex-col gap-2">
          {filtered.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/FilterableTodoList.tsx
git commit -m "feat: add priority filter pills and sort dropdown to FilterableTodoList"
```

---

## Task 7: Extend `TodoPage` helper and write E2E tests

**Files:**
- Modify: `tests/helpers/todo-page.ts`
- Create: `tests/specs/priority.spec.ts`

- [ ] **Step 1: Add priority helper methods to `TodoPage`**

Open `tests/helpers/todo-page.ts` and add these methods inside the `TodoPage` class, after the existing `selectFilter` method:

```ts
async addTodoWithPriority(title: string, priority: 'low' | 'medium' | 'high', note?: string) {
  await this.page.getByTestId('todo-title-input').fill(title)
  if (note !== undefined) {
    await this.page.getByTestId('todo-note-input').fill(note)
  }
  await this.page.getByTestId('todo-priority-select').selectOption(priority)
  await this.page.getByTestId('todo-add-button').click()
  await this.waitForTodo(title)
}

async expectPriority(title: string, priority: 'low' | 'medium' | 'high') {
  await expect(
    this.todoItem(title).getByTestId('todo-priority-badge'),
  ).toHaveText(priority.charAt(0).toUpperCase() + priority.slice(1))
}

async selectPriorityFilter(priority: 'low' | 'medium' | 'high') {
  await this.page.getByTestId(`priority-filter-${priority}`).click()
}

async setSortOrder(order: 'none' | 'high-first' | 'low-first') {
  await this.page.getByTestId('priority-sort-select').selectOption(order)
}

async editPriority(title: string, priority: 'low' | 'medium' | 'high') {
  await this.openEdit(title)
  await this.page.getByTestId('edit-priority-select').selectOption(priority)
  await this.page.getByTestId('edit-modal-save').click()
  await expect(this.page.getByTestId('edit-modal')).toHaveCount(0)
}
```

- [ ] **Step 2: Write the failing E2E tests**

Create `tests/specs/priority.spec.ts` with:

```ts
import { test, expect } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Priority — creation", () => {
  test("default priority is Medium when none selected", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Default task");
    await todoPage.expectPriority("Default task", "medium");
  });

  test("can create a todo with High priority", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Urgent task", "high");
    await todoPage.expectPriority("Urgent task", "high");
  });

  test("can create a todo with Low priority", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Backlog task", "low");
    await todoPage.expectPriority("Backlog task", "low");
  });
});

test.describe("Priority — editing", () => {
  test("can change priority from Medium to High via edit modal", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Editable task");
    await todoPage.editPriority("Editable task", "high");
    await todoPage.expectPriority("Editable task", "high");
  });

  test("priority persists after page reload", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Persistent task", "high");
    await page.reload();
    await todoPage.expectPriority("Persistent task", "high");
  });
});

test.describe("Priority — filtering", () => {
  test("filter by High shows only high-priority todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Important", "high");
    await todoPage.addTodoWithPriority("Not urgent", "low");

    await todoPage.selectPriorityFilter("high");

    await todoPage.waitForTodo("Important");
    await todoPage.expectTodoAbsent("Not urgent");
  });

  test("filter by Low shows only low-priority todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Important", "high");
    await todoPage.addTodoWithPriority("Not urgent", "low");

    await todoPage.selectPriorityFilter("low");

    await todoPage.waitForTodo("Not urgent");
    await todoPage.expectTodoAbsent("Important");
  });

  test("selecting two priority filters shows both", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("High task", "high");
    await todoPage.addTodoWithPriority("Medium task", "medium");
    await todoPage.addTodoWithPriority("Low task", "low");

    await todoPage.selectPriorityFilter("high");
    await todoPage.selectPriorityFilter("medium");

    await todoPage.waitForTodo("High task");
    await todoPage.waitForTodo("Medium task");
    await todoPage.expectTodoAbsent("Low task");
  });

  test("deselecting a priority filter restores those todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("High task", "high");
    await todoPage.addTodoWithPriority("Low task", "low");

    await todoPage.selectPriorityFilter("high");
    await todoPage.expectTodoAbsent("Low task");

    await todoPage.selectPriorityFilter("high");
    await todoPage.waitForTodo("Low task");
  });

  test("priority filter and status filter work together", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("High pending", "high");
    await todoPage.addTodoWithPriority("High done", "high");
    await todoPage.markDoneWithConfirmation("High done");

    await todoPage.selectPriorityFilter("high");
    await todoPage.selectFilter("pending");

    await todoPage.waitForTodo("High pending");
    await todoPage.expectTodoAbsent("High done");
  });
});

test.describe("Priority — sorting", () => {
  test("sort High first puts high-priority todos at the top", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Low task", "low");
    await todoPage.addTodoWithPriority("High task", "high");

    await todoPage.setSortOrder("high-first");

    const items = page.getByTestId("todo-item");
    await expect(items.first().getByTestId("todo-priority-badge")).toHaveText("High");
    await expect(items.last().getByTestId("todo-priority-badge")).toHaveText("Low");
  });

  test("sort Low first puts low-priority todos at the top", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodoWithPriority("Low task", "low");
    await todoPage.addTodoWithPriority("High task", "high");

    await todoPage.setSortOrder("low-first");

    const items = page.getByTestId("todo-item");
    await expect(items.first().getByTestId("todo-priority-badge")).toHaveText("Low");
    await expect(items.last().getByTestId("todo-priority-badge")).toHaveText("High");
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail (implementation already in place, so expect pass)**

```bash
npx playwright test tests/specs/priority.spec.ts --reporter=list
```

Expected: all tests pass. If any fail, check for typos in `data-testid` attributes.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
npx playwright test --reporter=list
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/todo-page.ts tests/specs/priority.spec.ts
git commit -m "test: add E2E tests for priority levels feature"
```
