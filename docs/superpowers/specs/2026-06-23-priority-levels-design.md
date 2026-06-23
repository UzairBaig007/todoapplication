# Priority Levels for Todos — Design Spec

**Date:** 2026-06-23
**Status:** Approved

## Overview

Add Low / Medium / High priority to each todo item. Priority is set on creation and editable at any time. It is displayed as a color-coded text badge on the todo card and can be used to filter and sort the list.

---

## Data Layer

### Prisma schema (`prisma/schema.prisma`)

Add a `Priority` enum:

```prisma
enum Priority {
  low
  medium
  high
}
```

Add a `priority` field to the `Todo` model with a default of `medium`:

```prisma
priority Priority @default(medium)
```

Run a Prisma migration after the schema change.

### `lib/todo.ts` additions

- `TODO_PRIORITIES = ["low", "medium", "high"] as const`
- `type TodoPriority = (typeof TODO_PRIORITIES)[number]`
- `PRIORITY_LABELS: Record<TodoPriority, string>` — `{ low: "Low", medium: "Medium", high: "High" }`
- `isPriority(value: string): value is TodoPriority` — type guard
- `getPriorityBadgeStyles(priority: TodoPriority): string` — returns Tailwind classes:
  - `high` → red badge
  - `medium` → amber badge
  - `low` → green badge
  - Each badge always includes a text label (not color-only) for accessibility

---

## Server Actions (`app/actions.ts`)

### `createTodo`
- Read `priority` from `formData`
- Validate with `isPriority()`; fall back to `"medium"` if missing or invalid
- Pass to `prisma.todo.create`

### `updateTodo`
- Add a `priority: TodoPriority` parameter
- Validate and save alongside `title` and `note` in `prisma.todo.update`

No new server actions are needed.

---

## UI Components

### `TodoForm`
- Add a `<select name="priority">` with options Low / Medium / High
- Default selected value: Medium

### `EditTodoModal`
- Add `priority` state, initialized from `todo.priority`
- Add a `<select>` for priority
- Pass the selected priority through `onSave` to `updateTodo`
- The `onSave` prop signature expands to include `priority: TodoPriority`

### `TodoItem`
- Render a priority badge below the title and above the note
- Badge uses `getPriorityBadgeStyles()` and shows the text label (e.g., "High")
- `handleEditSave` expands to include `priority: TodoPriority`

### `FilterableTodoList`

**Priority filter (multi-select):**
- Add `priorityFilter` state as `Set<TodoPriority>` (empty = all priorities shown)
- Render Low / Medium / High pills after the existing status pills, separated by a small gap
- Clicking a priority pill toggles membership in the set
- Filter logic: a todo passes if `priorityFilter` is empty OR its priority is in the set

**Sort dropdown:**
- Add `sortOrder` state: `"none" | "high-first" | "low-first"`
- Render a `<select>` above the todo list
- Sort the filtered array by priority before rendering:
  - `high-first`: high → medium → low
  - `low-first`: low → medium → high
  - `none`: original creation order

---

## Accessibility

- Priority badges include a visible text label — not color-only
- All `<select>` elements have associated `<label>` elements
- Priority pill buttons use descriptive `aria-label` or `aria-pressed` attributes to indicate selected state

---

## Acceptance Criteria

- [ ] Priority field appears in the create form (default: Medium)
- [ ] Priority field appears in the edit modal (pre-filled with current value)
- [ ] Priority badge (color + text label) renders below the title on each todo card
- [ ] Priority filter pills appear in the filter row; multi-select works together with status filter and search
- [ ] Sort dropdown controls priority sort order (High→Low, Low→High, None)
- [ ] Priority persists through page reload
- [ ] Existing todos (before migration) default to Medium
