/**
 * Playwright implementation of tests/features/delete-todo.feature
 */
import { test } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Delete todo", () => {
  test.beforeEach(async ({ page }) => {
    await new TodoPage(page).goto();
  });

  test("Delete todo with confirmation", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Old task");

    await todoPage.deleteTodo("Old task");
  });

  test("Cancel delete action", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Keep task");

    await todoPage.cancelDelete("Keep task");
  });
});
