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
