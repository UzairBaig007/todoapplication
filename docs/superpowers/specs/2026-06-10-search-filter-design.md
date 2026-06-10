# Search & Filter Design

**Date:** 2026-06-10
**Project:** todoapp (Next.js 16 + TypeScript + Prisma + SQLite)
**Scope:** Add real-time search and status filter to the todo list

---

## Overview

Add a search input and status filter controls above the todo list. Filtering runs entirely client-side — all todos are fetched once by the existing server component; a new client component handles the filter/search state and derives the visible subset in memory.

No new server actions, API routes, or npm packages are required.

---

## Architecture

### Component tree (after change)

```
page.tsx (server)
  → TodoForm (client)                     ← unchanged
  → TodoList (server)                     ← minimal change: pass todos to FilterableTodoList
      → ClearCompletedButton (client)     ← unchanged, still receives real unfiltered doneCount
      → FilterableTodoList (client, NEW)  ← owns search + filter state, renders filtered items
           → TodoItem[] (client)         ← unchanged
```

### New file

**`app/components/FilterableTodoList.tsx`** (client component)

Props:
```ts
{ todos: Todo[] }
```

State:
```ts
const [search, setSearch] = useState("");
const [filter, setFilter] = useState<FilterValue>("all");
type FilterValue = TodoStatus | "all";
```

Derived filtered list (no useEffect — computed inline on every render):
```ts
const filtered = todos.filter((todo) => {
  const matchesStatus = filter === "all" || todo.status === filter;
  const q = search.toLowerCase();
  const matchesSearch =
    q === "" ||
    todo.title.toLowerCase().includes(q) ||
    (todo.note ?? "").toLowerCase().includes(q);
  return matchesStatus && matchesSearch;
});
```

### Modified file

**`app/components/TodoList.tsx`**

- Pass `todos` array as props to `FilterableTodoList` instead of rendering `TodoItem` directly.
- Keep `ClearCompletedButton` in `TodoList` with the real unfiltered `doneCount` so "Clear Completed" always clears all done tasks regardless of current filter/search state.
- The existing empty-state message ("No todos yet. Add one above!") stays in `TodoList`, triggered when `todos.length === 0`.

---

## UI Layout

Controls are placed inside `FilterableTodoList`, above the item list:

```
[ Search input field                    ✕ ]
[ All ] [ Pending ] [ In Progress ] [ Completed ]

--- filtered todo items ---
```

### Search input
- Full-width text input, placeholder "Search tasks…"
- Styled with the existing `inputClassName` pattern (rounded-lg, border-zinc-300, bg-white, dark variants)
- A small clear button (✕) appears on the right when the input is non-empty; clicking it resets `search` to `""`

### Filter buttons
- Four pill/tab buttons: **All**, **Pending**, **In Progress**, **Completed**
- Active filter: filled dark style matching the existing "Add" button (`bg-foreground text-background`)
- Inactive filters: ghost/outline style (`border border-zinc-300 text-zinc-500 hover:bg-zinc-100`)
- Buttons map to filter values: `"all"`, `"pending"`, `"in_progress"`, `"done"`

### Empty states
- No todos at all → "No todos yet. Add one above!" — existing message, stays in `TodoList`
- Todos exist but none match current search/filter → "No tasks match your search." — new message inside `FilterableTodoList`

---

## Filtering Logic

- **Case-insensitive:** both query and field values are lowercased before comparison
- **Combined AND logic:** a task must satisfy both the status filter and the search query
- **Null note guard:** `(todo.note ?? "")` prevents null-reference errors
- **Empty query:** when `search === ""` the search condition is always true (shows all)
- **"All" filter:** when `filter === "all"` the status condition is always true

---

## What Is Not Changed

All of the following are untouched:

- `TodoForm` — add task
- `TodoItem` — edit, delete confirmation, complete confirmation, status dropdown
- `EditTodoModal` — edit title and note
- `ConfirmModal` — reusable confirmation dialog
- `ClearCompletedButton` — clears all done tasks (uses real unfiltered count)
- All server actions in `app/actions.ts`
- Prisma schema, migrations, database
- `lib/todo.ts`, `lib/prisma.ts`
- `app/layout.tsx`, `app/page.tsx`

---

## TypeScript

- `FilterValue = TodoStatus | "all"` defined locally in `FilterableTodoList.tsx`
- `Todo` type imported from `app/generated/prisma/client` (already used in `TodoItem`)
- `TodoStatus` and `STATUS_LABELS` imported from `lib/todo` for button labels

---

## Out of Scope

- URL-based filter persistence (not needed for a personal local todo app)
- Debouncing (client-side filtering is synchronous and instant)
- Server-side search/filter via Prisma WHERE clauses
