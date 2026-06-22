import { test, expect } from '../fixtures'

test.describe('Auth — unauthenticated redirect', () => {
  test('redirects unauthenticated users from / to /login', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
    await expect(page).toHaveURL('/login')
    await context.close()
  })
})

test.describe('Auth — signup', () => {
  test('signup page is accessible when not logged in', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await context.close()
  })

  test('signup with valid credentials auto-logs in and redirects to /', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await page.getByTestId('email-input').fill('newuser@example.com')
    await page.getByTestId('password-input').fill('NewPass123!')
    await page.getByTestId('confirm-password-input').fill('NewPass123!')
    await page.getByTestId('submit-button').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Uzair Baig Todo App' })).toBeVisible()
    await context.close()
  })

  test('signup shows error when passwords do not match', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await page.waitForURL('/signup')
    await page.getByTestId('email-input').fill('user@example.com')
    await page.getByTestId('password-input').fill('Password123!')
    await page.getByTestId('confirm-password-input').fill('Different123!')
    await page.getByTestId('submit-button').click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    await context.close()
  })

  test('signup shows error when email already exists', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await page.waitForURL('/signup')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('Password123!')
    await page.getByTestId('confirm-password-input').fill('Password123!')
    await page.getByTestId('submit-button').click()
    await expect(page.getByText('An account with this email already exists.')).toBeVisible()
    await context.close()
  })
})

test.describe('Auth — login', () => {
  test('login page is accessible when not logged in', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await context.close()
  })

  test('login with valid credentials redirects to /', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('TestPass123!')
    await page.getByTestId('submit-button').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Uzair Baig Todo App' })).toBeVisible()
    await context.close()
  })

  test('login shows error for wrong password', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('wrongpassword')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('auth-error')).toContainText('Invalid email or password.')
    await context.close()
  })
})

test.describe('Auth — logout', () => {
  test('sign out clears session and redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('sign-out-button').click()
    await expect(page).toHaveURL('/login')
  })

  test('after sign out, / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('sign-out-button').click()
    await expect(page).toHaveURL('/login')
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Auth — user email display', () => {
  test('shows logged-in user email on home page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('user-email')).toHaveText('test@example.com')
  })
})

test.describe('Auth — data isolation', () => {
  test('user A cannot see user B todos', async ({ page, browser }) => {
    await page.goto('/')
    await page.getByTestId('todo-title-input').fill('User A secret todo')
    await page.getByTestId('todo-add-button').click()
    await expect(page.locator('[data-testid="todo-item"]', { hasText: 'User A secret todo' })).toBeVisible()

    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    await pageB.goto('/signup')
    await pageB.getByTestId('email-input').fill('userb@example.com')
    await pageB.getByTestId('password-input').fill('UserBPass123!')
    await pageB.getByTestId('confirm-password-input').fill('UserBPass123!')
    await pageB.getByTestId('submit-button').click()
    await expect(pageB).toHaveURL('/')

    await expect(pageB.locator('[data-testid="todo-item"]', { hasText: 'User A secret todo' })).toHaveCount(0)
    await ctxB.close()
  })
})
