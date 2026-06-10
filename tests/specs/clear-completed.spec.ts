/**
 * Playwright implementation of tests/features/clear-completed.feature
 */
import { test } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Clear completed tasks", () => {
  test.beforeEach(async ({ page }) => {
    await new TodoPage(page).goto();
  });

  test("Clear all completed tasks with confirmation", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Done task");
    await todoPage.markDoneWithConfirmation("Done task");

    await todoPage.addTodo("Active task");

    await todoPage.clearCompleted();

    await todoPage.expectTodoAbsent("Done task");
    await todoPage.waitForTodo("Active task");
  });

  test("Clear completed button is hidden when no done tasks", async ({
    page,
  }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Only pending");

    await todoPage.expectClearCompletedVisible(false);
  });
});
