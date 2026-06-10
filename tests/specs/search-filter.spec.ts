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
