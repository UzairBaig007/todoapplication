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
