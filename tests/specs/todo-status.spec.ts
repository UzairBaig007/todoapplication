/**
 * Playwright implementation of tests/features/todo-status.feature
 */
import { test } from "../fixtures";
import { TodoPage } from "../helpers/todo-page";

test.describe("Todo status", () => {
  test.beforeEach(async ({ page }) => {
    await new TodoPage(page).goto();
  });

  test("Change status to in progress", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Write tests");

    await todoPage.setStatus("Write tests", "In progress");
    await todoPage.expectStatus("Write tests", "In progress");
  });

  test("Mark todo as done with confirmation", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Ship release");

    await todoPage.markDoneWithConfirmation("Ship release");
    await todoPage.expectStatus("Ship release", "Done");
  });

  test("Cancel marking todo as done", async ({ page }) => {
    const todoPage = new TodoPage(page);
    await todoPage.addTodo("Review PR");

    await todoPage.setStatus("Review PR", "Done");
    await todoPage.confirmModal(
      "Are you sure you want to mark this task as completed?",
    );
    await todoPage.clickConfirmNo();

    await todoPage.expectStatus("Review PR", "Pending");
  });
});
