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
