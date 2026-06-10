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
