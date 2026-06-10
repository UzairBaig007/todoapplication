# Search & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time client-side search and status filter controls above the todo list, combined with AND logic, without touching any existing functionality.

**Architecture:** `TodoList` (server component) fetches all todos and passes them as props to a new `FilterableTodoList` client component. `FilterableTodoList` owns `search` and `filter` state, derives the visible subset inline, and renders the filtered `TodoItem` list. `ClearCompletedButton` stays in `TodoList` with the real unfiltered `doneCount`.

**Tech Stack:** Next.js 16 App Router, React 19 (useState), TypeScript, Tailwind CSS v4, Prisma 7, Playwright (E2E tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/components/FilterableTodoList.tsx` | Search input, filter buttons, filtered item list |
| Modify | `app/components/TodoList.tsx` | Pass `todos` to `FilterableTodoList` instead of rendering `TodoItem` directly |
| Modify | `tests/helpers/todo-page.ts` | Add `search`, `clearSearch`, `selectFilter` helper methods |
| Create | `tests/specs/search-filter.spec.ts` | E2E tests for search and filter |

---

## Task 1: Add test helper methods and write failing E2E tests

**Files:**
- Modify: `tests/helpers/todo-page.ts`
- Create: `tests/specs/search-filter.spec.ts`

- [ ] **Step 1: Add search/filter helper methods to `TodoPage`**

Open `tests/helpers/todo-page.ts` and add these three methods at the end of the class, before the closing `}`:

```ts
  async search(query: string) {
    await this.page.getByTestId("search-input").fill(query);
  }

  async clearSearch() {
    await this.page.getByTestId("search-clear").click();
    await expect(this.page.getByTestId("search-input")).toHaveValue("");
  }

  async selectFilter(filter: "all" | "pending" | "in_progress" | "done") {
    await this.page.getByTestId(`filter-${filter}`).click();
  }
```

- [ ] **Step 2: Create `tests/specs/search-filter.spec.ts`**

```ts
import { test, expect } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Search", () => {
  test("filters by title", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Buy groceries");
    await todoPage.addTodo("Team meeting");

    await todoPage.search("groceries");

    await todoPage.waitForTodo("Buy groceries");
    await todoPage.expectTodoAbsent("Team meeting");
  });

  test("filters by note", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Stand-up", "Daily sync");
    await todoPage.addTodo("Lunch");

    await todoPage.search("Daily sync");

    await todoPage.waitForTodo("Stand-up");
    await todoPage.expectTodoAbsent("Lunch");
  });

  test("is case-insensitive", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Buy Milk");

    await todoPage.search("buy milk");

    await todoPage.waitForTodo("Buy Milk");
  });

  test("clearing search shows all todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Buy groceries");
    await todoPage.addTodo("Team meeting");

    await todoPage.search("groceries");
    await todoPage.expectTodoAbsent("Team meeting");

    await todoPage.clearSearch();

    await todoPage.waitForTodo("Buy groceries");
    await todoPage.waitForTodo("Team meeting");
  });

  test("shows empty state when no match", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Team meeting");

    await todoPage.search("zzznomatch");

    await expect(
      page.locator("text=No tasks match your search."),
    ).toBeVisible();
    await todoPage.expectTodoAbsent("Team meeting");
  });
});

test.describe("Filter", () => {
  test("filter by Pending shows only pending todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Pending task");
    await todoPage.addTodo("Done task");
    await todoPage.markDoneWithConfirmation("Done task");

    await todoPage.selectFilter("pending");

    await todoPage.waitForTodo("Pending task");
    await todoPage.expectTodoAbsent("Done task");
  });

  test("filter by In Progress shows only in-progress todos", async ({
    page,
  }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Active task");
    await todoPage.addTodo("Idle task");
    await todoPage.setStatus("Active task", "In progress");

    await todoPage.selectFilter("in_progress");

    await todoPage.waitForTodo("Active task");
    await todoPage.expectTodoAbsent("Idle task");
  });

  test("filter by Completed shows only done todos", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Done task");
    await todoPage.addTodo("Pending task");
    await todoPage.markDoneWithConfirmation("Done task");

    await todoPage.selectFilter("done");

    await todoPage.waitForTodo("Done task");
    await todoPage.expectTodoAbsent("Pending task");
  });

  test("All filter shows every todo", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Task A");
    await todoPage.addTodo("Task B");
    await todoPage.markDoneWithConfirmation("Task B");

    await todoPage.selectFilter("done");
    await todoPage.expectTodoAbsent("Task A");

    await todoPage.selectFilter("all");

    await todoPage.waitForTodo("Task A");
    await todoPage.waitForTodo("Task B");
  });
});

test.describe("Search + Filter combined", () => {
  test("applies AND logic: only shows todos matching both", async ({
    page,
  }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Buy groceries");
    await todoPage.addTodo("Buy tickets");
    await todoPage.markDoneWithConfirmation("Buy tickets");

    await todoPage.search("buy");
    await todoPage.selectFilter("pending");

    await todoPage.waitForTodo("Buy groceries");
    await todoPage.expectTodoAbsent("Buy tickets");
  });
});
```

---

## Task 2: Create `FilterableTodoList` component

**Files:**
- Create: `app/components/FilterableTodoList.tsx`

- [ ] **Step 1: Create `app/components/FilterableTodoList.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Todo } from "@/app/generated/prisma/client";
import { type TodoStatus } from "@/lib/todo";
import { TodoItem } from "./TodoItem";

type FilterValue = TodoStatus | "all";

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Completed" },
];

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

export function FilterableTodoList({ todos }: { todos: Todo[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");

  const filtered = todos.filter((todo) => {
    const matchesStatus = filter === "all" || todo.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      q === "" ||
      todo.title.toLowerCase().includes(q) ||
      (todo.note ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

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

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            data-testid={`filter-${value}`}
            className={
              filter === value
                ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            }
          >
            {label}
          </button>
        ))}
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

---

## Task 3: Wire `TodoList` to use `FilterableTodoList`

**Files:**
- Modify: `app/components/TodoList.tsx`

- [ ] **Step 1: Replace the file content**

Replace the full contents of `app/components/TodoList.tsx` with:

```tsx
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClearCompletedButton } from "./ClearCompletedButton";
import { FilterableTodoList } from "./FilterableTodoList";

export async function TodoList() {
  await connection();

  const [todos, doneCount] = await Promise.all([
    prisma.todo.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.todo.count({
      where: { status: "done" },
    }),
  ]);

  if (todos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No todos yet. Add one above!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ClearCompletedButton count={doneCount} />
      </div>
      <FilterableTodoList todos={todos} />
    </div>
  );
}
```

---

## Task 4: Verify build and tests pass

- [ ] **Step 1: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 2: Verify Next.js production build succeeds**

```bash
npm run build
```

Expected: output ends with `✓ Compiled successfully` and no type errors

- [ ] **Step 3: Run the full Playwright test suite**

```bash
npm test
```

Expected: all tests pass, including the new `search-filter.spec.ts` tests. The suite runs against a built production server on port 3099 with the test database.

- [ ] **Step 4: Commit**

```bash
git add app/components/FilterableTodoList.tsx app/components/TodoList.tsx tests/helpers/todo-page.ts tests/specs/search-filter.spec.ts
git commit -m "feat: add real-time search and status filter to todo list"
```
