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
