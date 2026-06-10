/**
 * Playwright implementation of tests/features/edit-todo.feature
 */
import { test, expect } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Edit todo", () => {
  test.beforeEach(async ({ page }) => {
    await new TodoPage(page).goto();
  });

  test("Edit todo title", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Draft email");

    await todoPage.openEdit("Draft email");
    await todoPage.saveEdit("Send email");

    await todoPage.waitForTodo("Send email");
    await todoPage.expectTodoAbsent("Draft email");
  });

  test("Edit todo note", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Call client", "Morning");

    await todoPage.openEdit("Call client");
    await todoPage.saveEdit("Call client", "Afternoon slot");

    await todoPage.expectNote("Call client", "Afternoon slot");
  });

  test("Cancel editing does not save changes", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Read docs");

    await todoPage.openEdit("Read docs");
    await page.getByTestId("edit-title-input").fill("Changed title");
    await todoPage.cancelEdit();

    await todoPage.waitForTodo("Read docs");
    await todoPage.expectTodoAbsent("Changed title");
  });

  test("Cannot save todo with empty title", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Valid task");

    await todoPage.openEdit("Valid task");
    await page.getByTestId("edit-title-input").fill("   ");
    await page.getByTestId("edit-modal-save").click();

    await expect(page.getByText("Title cannot be empty")).toBeVisible();
    await expect(page.getByTestId("edit-modal")).toBeVisible();
    await todoPage.cancelEdit();
    await todoPage.waitForTodo("Valid task");
  });
});
