import { expect, type Locator, type Page } from '@playwright/test'

export class TodoPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/')
    await this.page.waitForURL('/')
    await expect(this.page.getByRole('heading', { name: 'Baig Todo App' })).toBeVisible()
  }

  async addTodo(title: string, note?: string) {
    await this.page.getByTestId('todo-title-input').fill(title)
    if (note !== undefined) {
      await this.page.getByTestId('todo-note-input').fill(note)
    }
    await this.page.getByTestId('todo-add-button').click()
    await this.waitForTodo(title)
  }

  todoItem(title: string): Locator {
    return this.page.locator('[data-testid="todo-item"]', {
      has: this.page.locator('[data-testid="todo-item-title"]', { hasText: title }),
    })
  }

  async waitForTodo(title: string) {
    await expect(this.todoItem(title)).toBeVisible()
  }

  async expectTodoAbsent(title: string) {
    await expect(this.todoItem(title)).toHaveCount(0)
  }

  async expectNote(title: string, note: string) {
    await expect(
      this.todoItem(title).getByTestId('todo-item-note'),
    ).toHaveText(note)
  }

  async openEdit(title: string) {
    await this.todoItem(title).getByTestId('todo-edit-button').click()
    await expect(this.page.getByTestId('edit-modal')).toBeVisible()
  }

  async saveEdit(newTitle: string, newNote?: string) {
    await this.page.getByTestId('edit-title-input').fill(newTitle)
    if (newNote !== undefined) {
      await this.page.getByTestId('edit-note-input').fill(newNote)
    }
    await this.page.getByTestId('edit-modal-save').click()
    await expect(this.page.getByTestId('edit-modal')).toHaveCount(0)
  }

  async cancelEdit() {
    await this.page.getByTestId('edit-modal-cancel').click()
    await expect(this.page.getByTestId('edit-modal')).toHaveCount(0)
  }

  async setStatus(title: string, statusLabel: 'Pending' | 'In progress' | 'Done') {
    await this.todoItem(title)
      .getByTestId('todo-status-select')
      .selectOption({ label: statusLabel })
  }

  async confirmModal(message: string) {
    const modal = this.page.getByTestId('confirm-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText(message)
    return modal
  }

  async clickConfirmYes() {
    await this.page.getByTestId('confirm-modal-confirm').click()
    await expect(this.page.getByTestId('confirm-modal')).toHaveCount(0)
  }

  async clickConfirmNo() {
    await this.page.getByTestId('confirm-modal-cancel').click()
    await expect(this.page.getByTestId('confirm-modal')).toHaveCount(0)
  }

  async markDoneWithConfirmation(title: string) {
    await this.setStatus(title, 'Done')
    await this.confirmModal(
      'Are you sure you want to mark this task as completed?',
    )
    await this.clickConfirmYes()
  }

  async deleteTodo(title: string) {
    await this.todoItem(title).getByTestId('todo-delete-button').click()
    await this.confirmModal('Are you sure you want to delete this task?')
    await this.clickConfirmYes()
    await this.expectTodoAbsent(title)
  }

  async cancelDelete(title: string) {
    await this.todoItem(title).getByTestId('todo-delete-button').click()
    await this.confirmModal('Are you sure you want to delete this task?')
    await this.clickConfirmNo()
    await this.waitForTodo(title)
  }

  async clearCompleted() {
    await this.page.getByTestId('clear-completed-button').click()
    await this.confirmModal(
      'Are you sure you want to delete all completed tasks?',
    )
    await this.clickConfirmYes()
  }

  async expectStatus(title: string, statusLabel: string) {
    await expect(
      this.todoItem(title).getByTestId('todo-status-select'),
    ).toHaveValue(
      statusLabel === 'Pending'
        ? 'pending'
        : statusLabel === 'In progress'
          ? 'in_progress'
          : 'done',
    )
  }

  async expectClearCompletedVisible(visible: boolean) {
    const button = this.page.getByTestId('clear-completed-button')
    if (visible) {
      await expect(button).toBeVisible()
    } else {
      await expect(button).toHaveCount(0)
    }
  }

  async search(query: string) {
    await this.page.getByTestId('search-input').fill(query)
  }

  async clearSearch() {
    await this.page.getByTestId('search-clear').click()
    await expect(this.page.getByTestId('search-input')).toHaveValue('')
  }

  async selectFilter(filter: 'all' | 'pending' | 'in_progress' | 'done') {
    await this.page.getByTestId(`filter-${filter}`).click()
  }
}
