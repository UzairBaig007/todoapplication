/**
 * Playwright implementation of tests/features/add-todo.feature
 */
import { test, expect } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Add todo", () => {
  test("Add a todo without a note", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Buy groceries");

    await todoPage.waitForTodo("Buy groceries");
    await expect(
      todoPage.todoItem("Buy groceries").getByTestId("todo-item-note"),
    ).toHaveCount(0);
  });

  test("Add a todo with a note", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addTodo("Team meeting", "Prepare agenda");

    await todoPage.waitForTodo("Team meeting");
    await todoPage.expectNote("Team meeting", "Prepare agenda");
  });
});
