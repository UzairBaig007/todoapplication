# Signup & Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-based signup/login/logout so each user has their own private todo list, per `docs/superpowers/specs/2026-06-16-auth-design.md`.

**Architecture:** A new `User` Prisma model + `Todo.userId`; password hashing via `bcryptjs`; a signed JWT session stored in an HTTP-only cookie (via `jose`), verified by `middleware.ts` for route protection and read by server actions/components to scope all todo data per user. UI follows the existing pattern of controlled-input client components calling server actions directly (see `EditTodoModal.tsx`), not native form-action submission.

**Tech Stack:** Next.js App Router, Prisma 7 (SQLite), `bcryptjs`, `jose`, Playwright (existing E2E setup).

---

## Important environment note

Before this plan was written, the working directory's `package.json`/`package-lock.json` had been accidentally changed to downgrade `next` to `^9.3.3` and `prisma` to `^6.19.3` (incompatible with this app's App Router / Server Actions code) and `node_modules` was reinstalled to match. **This has already been fixed** — `package.json`/`package-lock.json` were reverted to the committed versions (`next@16.2.7`, `prisma@^7.8.0`) and `npm install` was re-run; `next/headers` and `next/cache` resolve correctly again. No task below needs to redo this, but if `npm run dev`/`npm test` ever fail with missing-module errors on `next/headers` or `next/cache`, check `package.json` hasn't regressed again.

---

## File Map

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Modify: add `User` model, `Todo.userId` |
| `lib/auth/password.ts` | New: hash/verify passwords (bcryptjs) |
| `lib/auth/validation.ts` | New: email/password validators |
| `lib/auth/session.ts` | New: edge-safe JWT create/verify + cookie options (no `next/headers`) |
| `lib/auth/server-session.ts` | New: cookie-based session helpers for Server Actions/Components (`next/headers`) |
| `app/auth-actions.ts` | New: `signup`, `login`, `logout` server actions |
| `app/signup/page.tsx`, `app/components/SignupForm.tsx` | New: signup UI |
| `app/login/page.tsx`, `app/components/LoginForm.tsx` | New: login UI |
| `app/components/LogoutButton.tsx` | New: logout UI, added to `app/page.tsx` |
| `middleware.ts` | New: route protection + sliding session refresh |
| `app/actions.ts` | Modify: scope all todo mutations to the session user |
| `app/components/TodoList.tsx` | Modify: scope todo reads to the session user |
| `app/api/test/reset/route.ts` | Modify: also delete users |
| `app/api/test/login/route.ts` | New: test-only quick login |
| `tests/helpers/reset.ts` | Modify: rename `resetTodos` → `resetDatabase` |
| `tests/helpers/login-as.ts` | New: test helper to call `/api/test/login` |
| `tests/helpers/auth-page.ts` | New: page object for signup/login/logout |
| `tests/fixtures.ts` | Modify: use renamed `resetDatabase` |
| `tests/authenticated-fixtures.ts` | New: reset + auto-login fixture for existing todo specs |
| `tests/specs/{add,edit,delete,clear-completed,todo-status,search-filter}*.spec.ts` | Modify: import from `authenticated-fixtures` |
| `tests/features/*.feature`, `tests/specs/*.spec.ts` (signup/login/logout/route-protection/todo-isolation) | New: E2E coverage |
| `tests/README.md` | Modify: update mapping table |
| `.env`, `.env.test` | Modify: add `SESSION_SECRET` |

---

### Task 1: Install auth dependencies & configure session secret

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `.env`, `.env.test`

- [ ] **Step 1: Install runtime dependencies**

Run: `npm install bcryptjs jose`

- [ ] **Step 2: Install type definitions**

Run: `npm install -D @types/bcryptjs`

- [ ] **Step 3: Generate session secrets**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run it twice (once for dev, once for test) and keep the two hex strings for the next step.

- [ ] **Step 4: Add `SESSION_SECRET` to `.env` and `.env.test`**

Append to `.env` (use the first generated value):
```
SESSION_SECRET="<paste first generated hex value>"
```

Append to `.env.test` (use the second generated value):
```
SESSION_SECRET="<paste second generated hex value>"
```

Both files are already gitignored (`.env*` in `.gitignore`), so these secrets are never committed.

- [ ] **Step 5: Verify install**

Run: `node -e "require('bcryptjs'); require('jose'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add bcryptjs and jose dependencies for authentication"
```

---

### Task 2: Update Prisma schema for accounts & per-user todos

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/api/test/reset/route.ts`
- Modify: `tests/helpers/reset.ts`
- Modify: `tests/fixtures.ts`

- [ ] **Step 1: Add the `User` model and `Todo.userId` to the schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum TodoStatus {
  pending
  in_progress
  done
}

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  todos        Todo[]
}

model Todo {
  id        Int        @id @default(autoincrement())
  title     String
  note      String?
  status    TodoStatus @default(pending)
  createdAt DateTime   @default(now())
  userId    Int
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Reset the local dev database**

The existing `dev.db` has ownerless demo todos that aren't worth migrating (per design decision). Delete it so the next migration creates a fresh schema:

Run: `rm -f prisma/dev.db prisma/dev.db-journal`

- [ ] **Step 3: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_user_auth`
Expected: output ending in `Your database is now in sync with your schema.` and a new folder under `prisma/migrations/` (timestamp prefix + `add_user_auth`).

- [ ] **Step 4: Update the test-reset route to also clear users**

In `app/api/test/reset/route.ts`, change:

```ts
export async function POST() {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.todo.deleteMany();
  return NextResponse.json({ ok: true });
}
```

to:

```ts
export async function POST() {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.todo.deleteMany();
  await prisma.user.deleteMany();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Rename the reset helper (it now resets more than todos)**

Replace `tests/helpers/reset.ts` with:

```ts
import type { APIRequestContext } from "@playwright/test";

export async function resetDatabase(request: APIRequestContext, baseURL: string) {
  const response = await request.post(`${baseURL}/api/test/reset`);
  if (!response.ok()) {
    throw new Error(`Failed to reset database: ${response.status()} ${await response.text()}`);
  }
}
```

- [ ] **Step 6: Update the one call site**

In `tests/fixtures.ts`, change:

```ts
import { resetTodos } from "./helpers/reset";
```
to:
```ts
import { resetDatabase } from "./helpers/reset";
```

and change:
```ts
    await resetTodos(request, baseURL);
```
to:
```ts
    await resetDatabase(request, baseURL);
```

- [ ] **Step 7: Run the existing suite to confirm the expected interim failure**

Run: `npm test`
Expected: **these tests will now fail** — `Todo.userId` is a required column with no default, but `createTodo` in `app/actions.ts` doesn't supply it yet, so every test that adds a todo (most of them) will error. This is expected and intentional: this column requirement is exactly what forces the user-scoping work in Task 7. Confirm the failures are all the same root cause (missing `userId`), then proceed — do not try to fix it here.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations app/api/test/reset/route.ts tests/helpers/reset.ts tests/fixtures.ts
git commit -m "Add User model and Todo.userId for per-user todos"
```

---

### Task 3: Auth library foundation (password hashing, validation, session tokens)

**Files:**
- Create: `lib/auth/password.ts`
- Create: `lib/auth/validation.ts`
- Create: `lib/auth/session.ts`
- Create: `lib/auth/server-session.ts`

> No standalone unit tests here — this project's testing strategy is Playwright E2E only (see `tests/README.md`). These modules are exercised end-to-end starting in Task 4 (signup).

- [ ] **Step 1: Password hashing**

Create `lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 2: Validation helpers**

Create `lib/auth/validation.ts`:

```ts
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
```

- [ ] **Step 3: Edge-safe session token utilities**

These use only `jose` (Web Crypto) so they're safe to import from `middleware.ts`, which runs in the Edge runtime. They must NOT import `next/headers`.

Create `lib/auth/session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    )
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "number") {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
```

- [ ] **Step 4: Server-only session helpers (Server Actions / Server Components)**

Create `lib/auth/server-session.ts`:

```ts
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session";

export async function createSession(userId: number): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export async function getSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
```

- [ ] **Step 5: Sanity-check the build**

Run: `npx tsc --noEmit`
Expected: no errors related to the new `lib/auth/*` files.

- [ ] **Step 6: Commit**

```bash
git add lib/auth
git commit -m "Add auth library foundation: password hashing, validation, session tokens"
```

---

### Task 4: Signup feature

**Files:**
- Create: `app/auth-actions.ts`
- Create: `app/signup/page.tsx`
- Create: `app/components/SignupForm.tsx`
- Create: `tests/helpers/auth-page.ts`
- Create: `tests/features/signup.feature`
- Create: `tests/specs/signup.spec.ts`

- [ ] **Step 1: Write the page object helper used by all auth E2E tests**

Create `tests/helpers/auth-page.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export class AuthPage {
  constructor(readonly page: Page) {}

  async gotoSignup() {
    await this.page.goto("/signup");
    await expect(this.page.getByTestId("signup-form")).toBeVisible();
  }

  async gotoLogin() {
    await this.page.goto("/login");
    await expect(this.page.getByTestId("login-form")).toBeVisible();
  }

  async signup(email: string, password: string) {
    await this.page.getByTestId("signup-email-input").fill(email);
    await this.page.getByTestId("signup-password-input").fill(password);
    await this.page.getByTestId("signup-submit-button").click();
  }

  async login(email: string, password: string) {
    await this.page.getByTestId("login-email-input").fill(email);
    await this.page.getByTestId("login-password-input").fill(password);
    await this.page.getByTestId("login-submit-button").click();
  }

  async expectSignupError(message: string) {
    await expect(this.page.getByTestId("signup-error")).toHaveText(message);
  }

  async expectLoginError(message: string) {
    await expect(this.page.getByTestId("login-error")).toHaveText(message);
  }

  async expectOnHomePage() {
    await expect(
      this.page.getByRole("heading", { name: "My Todo App" }),
    ).toBeVisible();
  }

  async logout() {
    await this.page.getByTestId("logout-button").click();
    await expect(this.page.getByTestId("login-form")).toBeVisible();
  }
}
```

- [ ] **Step 2: Write the feature file**

Create `tests/features/signup.feature`:

```gherkin
Feature: Signup
  As a new user
  I want to create an account with an email and password
  So that I can manage my own private todo list

  Scenario: Sign up with valid details
    Given I am on the signup page
    When I sign up with email "alice@example.com" and password "password123"
    Then I should be redirected to the todo application page

  Scenario: Reject duplicate email
    Given a user already exists with email "bob@example.com"
    And I am on the signup page
    When I sign up with email "bob@example.com" and password "password123"
    Then I should see the signup error "Email already in use"

  Scenario: Reject invalid email format
    Given I am on the signup page
    When I sign up with email "not-an-email" and password "password123"
    Then I should see the signup error "Enter a valid email address"

  Scenario: Reject short password
    Given I am on the signup page
    When I sign up with email "carol@example.com" and password "short"
    Then I should see the signup error "Password must be at least 8 characters"
```

- [ ] **Step 3: Write the spec (will fail — no `/signup` route yet)**

Create `tests/specs/signup.spec.ts`:

```ts
/**
 * Playwright implementation of tests/features/signup.feature
 */
import { test, expect } from "../fixtures";
import { AuthPage } from "../helpers/auth-page";

test.describe("Signup", () => {
  test("Sign up with valid details", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("alice@example.com", "password123");
    await auth.expectOnHomePage();
  });

  test("Reject duplicate email", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("bob@example.com", "password123");
    await auth.expectOnHomePage();

    await auth.logout();
    await auth.gotoSignup();
    await auth.signup("bob@example.com", "password123");
    await auth.expectSignupError("Email already in use");
  });

  test("Reject invalid email format", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("not-an-email", "password123");
    await auth.expectSignupError("Enter a valid email address");
  });

  test("Reject short password", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("carol@example.com", "short");
    await auth.expectSignupError("Password must be at least 8 characters");
  });
});
```

Note: the "Reject duplicate email" test depends on the `logout-button` testid, which is built in Task 6. Skip running that one scenario until Task 6 is done — run the other three now.

- [ ] **Step 4: Run the spec to verify it fails**

Run: `npx playwright test tests/specs/signup.spec.ts -g "Sign up with valid details"`
Expected: FAIL (navigating to `/signup` 404s, `signup-form` testid never appears)

- [ ] **Step 5: Implement the signup server action**

Create `app/auth-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { createSession } from "@/lib/auth/server-session";

export async function signup(
  email: string,
  password: string,
): Promise<{ ok: false; error: string }> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return { ok: false, error: "Email is required" };
  }
  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  if (!password) {
    return { ok: false, error: "Password is required" };
  }
  if (!isValidPassword(password)) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: trimmedEmail },
  });
  if (existing) {
    return { ok: false, error: "Email already in use" };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: trimmedEmail, passwordHash },
  });

  await createSession(user.id);
  redirect("/");
}
```

- [ ] **Step 6: Build the signup form**

Create `app/components/SignupForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { signup } from "@/app/auth-actions";
import {
  isValidEmail,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/validation";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (!isValidPassword(password)) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await signup(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      data-testid="signup-form"
      className="flex w-full flex-col gap-3"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        data-testid="signup-email-input"
        className={inputClassName}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
        data-testid="signup-password-input"
        className={inputClassName}
      />
      {error && (
        <p data-testid="signup-error" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        data-testid="signup-submit-button"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing up…" : "Sign Up"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Build the signup page**

Create `app/signup/page.tsx`:

```tsx
import Link from "next/link";
import { SignupForm } from "@/app/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-sm">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sign up to start managing your tasks.
          </p>
        </header>

        <SignupForm />

        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Run the spec again to verify the first three scenarios pass**

Run: `npx playwright test tests/specs/signup.spec.ts -g "Sign up with valid details|Reject invalid email format|Reject short password"`
Expected: 3 passed (the "Reject duplicate email" scenario still needs Task 6's logout button — leave it failing for now)

- [ ] **Step 9: Commit**

```bash
git add app/auth-actions.ts app/signup app/components/SignupForm.tsx tests/helpers/auth-page.ts tests/features/signup.feature tests/specs/signup.spec.ts
git commit -m "Add signup feature"
```

---

### Task 5: Login feature

**Files:**
- Modify: `app/auth-actions.ts`
- Create: `app/login/page.tsx`
- Create: `app/components/LoginForm.tsx`
- Create: `tests/features/login.feature`
- Create: `tests/specs/login.spec.ts`

- [ ] **Step 1: Write the feature file**

Create `tests/features/login.feature`:

```gherkin
Feature: Login
  As a registered user
  I want to log into my account
  So that I can access my private todo list

  Background:
    Given a user already exists with email "dave@example.com" and password "password123"

  Scenario: Log in with valid credentials
    Given I am on the login page
    When I log in with email "dave@example.com" and password "password123"
    Then I should be redirected to the todo application page

  Scenario: Reject invalid credentials
    Given I am on the login page
    When I log in with email "dave@example.com" and password "wrongpassword"
    Then I should see the login error "Invalid email or password"

  Scenario: Block empty field submission
    Given I am on the login page
    When I submit the login form with empty email and password
    Then I should see the login error "Email and password are required"
```

- [ ] **Step 2: Write the spec (will fail — no `/login` route yet)**

Create `tests/specs/login.spec.ts`:

```ts
/**
 * Playwright implementation of tests/features/login.feature
 */
import { test, expect } from "../fixtures";
import { AuthPage } from "../helpers/auth-page";

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("dave@example.com", "password123");
    await auth.expectOnHomePage();
    // Drop the session created by signup so each test starts logged out.
    await page.context().clearCookies();
  });

  test("Log in with valid credentials", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.login("dave@example.com", "password123");
    await auth.expectOnHomePage();
  });

  test("Reject invalid credentials", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.login("dave@example.com", "wrongpassword");
    await auth.expectLoginError("Invalid email or password");
  });

  test("Block empty field submission", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.login("", "");
    await auth.expectLoginError("Email and password are required");
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `npx playwright test tests/specs/login.spec.ts`
Expected: FAIL (`/login` 404s, `login-form` testid never appears)

- [ ] **Step 4: Add the login server action**

In `app/auth-actions.ts`, add (alongside the existing `signup` function — keep the existing imports, just add `verifyPassword` to the import from `@/lib/auth/password`):

```ts
import { hashPassword, verifyPassword } from "@/lib/auth/password";
```

and append:

```ts
export async function login(
  email: string,
  password: string,
): Promise<{ ok: false; error: string }> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  const user = await prisma.user.findUnique({
    where: { email: trimmedEmail },
  });
  if (!user) {
    return { ok: false, error: "Invalid email or password" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/");
}
```

- [ ] **Step 5: Build the login form**

Create `app/components/LoginForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { login } from "@/app/auth-actions";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      data-testid="login-form"
      className="flex w-full flex-col gap-3"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        data-testid="login-email-input"
        className={inputClassName}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        data-testid="login-password-input"
        className={inputClassName}
      />
      {error && (
        <p data-testid="login-error" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        data-testid="login-submit-button"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Logging in…" : "Login"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Build the login page**

Create `app/login/page.tsx`:

```tsx
import Link from "next/link";
import { LoginForm } from "@/app/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-sm">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Log in
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Welcome back. Enter your credentials to continue.
          </p>
        </header>

        <LoginForm />

        <p className="mt-4 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `npx playwright test tests/specs/login.spec.ts`
Expected: 3 passed

- [ ] **Step 8: Commit**

```bash
git add app/auth-actions.ts app/login app/components/LoginForm.tsx tests/features/login.feature tests/specs/login.spec.ts
git commit -m "Add login feature"
```

---

### Task 6: Logout feature

**Files:**
- Modify: `app/auth-actions.ts`
- Create: `app/components/LogoutButton.tsx`
- Modify: `app/page.tsx`
- Create: `tests/features/logout.feature`
- Create: `tests/specs/logout.spec.ts`

- [ ] **Step 1: Write the feature file**

Create `tests/features/logout.feature`:

```gherkin
Feature: Logout
  As a logged-in user
  I want to log out of my account
  So that my session ends and others can't access my todos

  Scenario: Log out clears the session
    Given I am logged in as "erin@example.com"
    When I log out
    Then I should be on the login page
```

- [ ] **Step 2: Write the spec (will fail — no logout button yet)**

Create `tests/specs/logout.spec.ts`:

```ts
/**
 * Playwright implementation of tests/features/logout.feature
 */
import { test, expect } from "../fixtures";
import { AuthPage } from "../helpers/auth-page";

test.describe("Logout", () => {
  test("Log out clears the session", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("erin@example.com", "password123");
    await auth.expectOnHomePage();

    await auth.logout();
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `npx playwright test tests/specs/logout.spec.ts`
Expected: FAIL (`logout-button` testid not found)

- [ ] **Step 4: Add the logout server action**

Append to `app/auth-actions.ts` (add `clearSession` to the existing `@/lib/auth/server-session` import):

```ts
import { clearSession, createSession } from "@/lib/auth/server-session";
```

and append:

```ts
export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
```

- [ ] **Step 5: Build the logout button**

Create `app/components/LogoutButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { logout } from "@/app/auth-actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => logout())}
      disabled={isPending}
      data-testid="logout-button"
      className="text-sm text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
    >
      {isPending ? "Logging out…" : "Logout"}
    </button>
  );
}
```

- [ ] **Step 6: Add the button to the home page header**

Replace the contents of `app/page.tsx` with:

```tsx
import { TodoForm } from "./components/TodoForm";
import { TodoList } from "./components/TodoList";
import { LogoutButton } from "./components/LogoutButton";

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-lg">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              My Todo App
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage tasks with status, notes, and editing.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="mb-6">
          <TodoForm />
        </section>

        <section>
          <TodoList />
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `npx playwright test tests/specs/logout.spec.ts`
Expected: 1 passed

- [ ] **Step 8: Run the signup spec's previously-skipped scenario**

Run: `npx playwright test tests/specs/signup.spec.ts -g "Reject duplicate email"`
Expected: 1 passed (it was waiting on the logout button built in this task)

- [ ] **Step 9: Commit**

```bash
git add app/auth-actions.ts app/components/LogoutButton.tsx app/page.tsx tests/features/logout.feature tests/specs/logout.spec.ts
git commit -m "Add logout feature"
```

---

### Task 7: Authenticated test infrastructure + per-user todo isolation

**Files:**
- Create: `app/api/test/login/route.ts`
- Create: `tests/helpers/login-as.ts`
- Create: `tests/authenticated-fixtures.ts`
- Modify: `tests/specs/add-todo.spec.ts`, `tests/specs/clear-completed.spec.ts`, `tests/specs/delete-todo.spec.ts`, `tests/specs/edit-todo.spec.ts`, `tests/specs/search-filter.spec.ts`, `tests/specs/todo-status.spec.ts`
- Modify: `app/actions.ts`
- Modify: `app/components/TodoList.tsx`
- Create: `tests/features/todo-isolation.feature`
- Create: `tests/specs/todo-isolation.spec.ts`

> This task resolves the interim breakage from Task 2: `Todo.userId` is required, but nothing supplies it yet. It also gives the six pre-existing todo specs a logged-in session (since `app/actions.ts` is about to start requiring one), and adds dedicated coverage proving todos are actually private per account. These three things land together because they're genuinely interdependent — there's no clean checkpoint to split them where the suite would be green in between.

- [ ] **Step 1: Add a test-only login endpoint**

Create `app/api/test/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";

function isTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("test.db");
}

export async function POST(request: Request) {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password } = await request.json();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
```

- [ ] **Step 2: Add a Playwright helper that calls it**

Create `tests/helpers/login-as.ts`:

```ts
import type { Page } from "@playwright/test";

export async function loginAsTestUser(page: Page, baseURL: string) {
  await page.request.post(`${baseURL}/api/test/login`, {
    data: { email: "test@example.com", password: "password123" },
  });
}
```

Using `page.request` (not the global `request` fixture) ensures the `Set-Cookie` response lands in the same browsing context as `page`, so the cookie is present on the next `page.goto(...)`.

- [ ] **Step 3: Add an authenticated fixture for the existing todo specs**

Create `tests/authenticated-fixtures.ts`:

```ts
import { test as base } from "@playwright/test";
import { resetDatabase } from "./helpers/reset";
import { loginAsTestUser } from "./helpers/login-as";

export const test = base.extend({
  page: async ({ page, request, baseURL }, use) => {
    if (!baseURL) {
      throw new Error("baseURL is required for E2E tests");
    }
    await resetDatabase(request, baseURL);
    await loginAsTestUser(page, baseURL);
    await use(page);
  },
});

export { expect } from "@playwright/test";
```

- [ ] **Step 4: Point the existing todo specs at the authenticated fixture**

In each of these six files, change the import line from:
```ts
import { test, expect } from "../fixtures";
```
to:
```ts
import { test, expect } from "../authenticated-fixtures";
```

Files: `tests/specs/add-todo.spec.ts`, `tests/specs/clear-completed.spec.ts`, `tests/specs/delete-todo.spec.ts`, `tests/specs/edit-todo.spec.ts`, `tests/specs/search-filter.spec.ts`, `tests/specs/todo-status.spec.ts`.

- [ ] **Step 5: Write the feature file for per-user isolation**

Create `tests/features/todo-isolation.feature`:

```gherkin
Feature: Per-user todo isolation
  As a user
  I want my todos kept private
  So that other accounts cannot see or modify them

  Scenario: Todos are not visible across accounts
    Given I sign up as "henry@example.com" and add a todo titled "Henry's task"
    When I log out and sign up as "irene@example.com"
    Then I should not see a todo titled "Henry's task"

  Scenario: Todos persist for the owning account across sessions
    Given I sign up as "jack@example.com" and add a todo titled "Jack's task"
    When I log out and log back in as "jack@example.com"
    Then I should see a todo titled "Jack's task"
```

- [ ] **Step 6: Write the spec (will fail — todos are still global, and `userId` isn't supplied yet)**

Create `tests/specs/todo-isolation.spec.ts`:

```ts
/**
 * Playwright implementation of tests/features/todo-isolation.feature
 */
import { test, expect } from "../fixtures";
import { AuthPage } from "../helpers/auth-page";
import { TodoPage } from "../helpers/todo-page";

test.describe("Per-user todo isolation", () => {
  test("Todos are not visible across accounts", async ({ page }) => {
    const auth = new AuthPage(page);
    const todos = new TodoPage(page);

    await auth.gotoSignup();
    await auth.signup("henry@example.com", "password123");
    await todos.addTodo("Henry's task");

    await auth.logout();
    await auth.gotoSignup();
    await auth.signup("irene@example.com", "password123");

    await todos.goto();
    await todos.expectTodoAbsent("Henry's task");
  });

  test("Todos persist for the owning account across sessions", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    const todos = new TodoPage(page);

    await auth.gotoSignup();
    await auth.signup("jack@example.com", "password123");
    await todos.addTodo("Jack's task");

    await auth.logout();
    await auth.gotoLogin();
    await auth.login("jack@example.com", "password123");

    await todos.goto();
    await todos.waitForTodo("Jack's task");
  });
});
```

- [ ] **Step 7: Run the spec to verify it fails**

Run: `npx playwright test tests/specs/todo-isolation.spec.ts`
Expected: FAIL — `addTodo` errors because `createTodo` doesn't supply the now-required `userId` yet (same root cause flagged in Task 2)

- [ ] **Step 8: Scope todo actions to the session user**

Replace the contents of `app/actions.ts` with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/server-session";
import { isTodoStatus, type TodoStatus } from "@/lib/todo";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

export async function createTodo(formData: FormData) {
  const userId = await requireUserId();
  const title = formData.get("title")?.toString().trim();
  if (!title) return;

  const note = formData.get("note")?.toString().trim() || null;

  await prisma.todo.create({
    data: { title, note, userId },
  });
  revalidatePath("/");
}

export async function updateTodoStatus(id: number, status: string) {
  const userId = await requireUserId();
  if (!isTodoStatus(status)) return;

  await prisma.todo.updateMany({
    where: { id, userId },
    data: { status: status as TodoStatus },
  });
  revalidatePath("/");
}

export async function updateTodo(
  id: number,
  title: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { ok: false, error: "Title cannot be empty" };
  }

  const trimmedNote = note?.trim() || null;

  const result = await prisma.todo.updateMany({
    where: { id, userId },
    data: { title: trimmedTitle, note: trimmedNote },
  });
  if (result.count === 0) {
    return { ok: false, error: "Todo not found" };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTodo(id: number) {
  const userId = await requireUserId();
  await prisma.todo.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function clearCompletedTodos() {
  const userId = await requireUserId();
  await prisma.todo.deleteMany({
    where: { status: "done", userId },
  });
  revalidatePath("/");
}
```

- [ ] **Step 9: Scope todo reads to the session user**

Replace the contents of `app/components/TodoList.tsx` with:

```tsx
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/server-session";
import { ClearCompletedButton } from "./ClearCompletedButton";
import { FilterableTodoList } from "./FilterableTodoList";

export async function TodoList() {
  await connection();

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [todos, doneCount] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.todo.count({
      where: { status: "done", userId: session.userId },
    }),
  ]);

  if (todos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No todos yet. Add one above!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ClearCompletedButton count={doneCount} />
      </div>
      <FilterableTodoList todos={todos} />
    </div>
  );
}
```

- [ ] **Step 10: Run the spec to verify it passes**

Run: `npx playwright test tests/specs/todo-isolation.spec.ts`
Expected: 2 passed

- [ ] **Step 11: Run the full suite — this is the checkpoint where everything is green again**

Run: `npm test`
Expected: all tests pass — the six pre-existing todo specs (now using the authenticated fixture from Step 3) work again because `createTodo` finally supplies a `userId`, and the new isolation test confirms accounts can't see each other's todos.

- [ ] **Step 12: Commit**

```bash
git add app/api/test/login tests/helpers/login-as.ts tests/authenticated-fixtures.ts tests/specs/add-todo.spec.ts tests/specs/clear-completed.spec.ts tests/specs/delete-todo.spec.ts tests/specs/edit-todo.spec.ts tests/specs/search-filter.spec.ts tests/specs/todo-status.spec.ts app/actions.ts app/components/TodoList.tsx tests/features/todo-isolation.feature tests/specs/todo-isolation.spec.ts
git commit -m "Scope todos per-user and give existing specs an authenticated session"
```

---

### Task 8: Route protection middleware

**Files:**
- Create: `middleware.ts`
- Create: `tests/features/route-protection.feature`
- Create: `tests/specs/route-protection.spec.ts`

> Going into this task the suite is fully green (Task 7). This task is purely additive: it adds a redirect layer in front of pages that `app/actions.ts`/`TodoList.tsx` already implicitly require a session for.

- [ ] **Step 1: Write the feature file**

Create `tests/features/route-protection.feature`:

```gherkin
Feature: Route protection
  As the application
  I want to gate the todo page behind login
  So that only authenticated users can access it

  Scenario: Unauthenticated visit to the home page redirects to login
    Given I am not logged in
    When I visit the todo application page
    Then I should be redirected to the login page

  Scenario: Authenticated visit to the login page redirects home
    Given I am logged in as "frank@example.com"
    When I visit the login page
    Then I should be redirected to the todo application page

  Scenario: Authenticated visit to the signup page redirects home
    Given I am logged in as "gina@example.com"
    When I visit the signup page
    Then I should be redirected to the todo application page
```

- [ ] **Step 2: Write the spec (uses the plain, unauthenticated fixture)**

Create `tests/specs/route-protection.spec.ts`:

```ts
/**
 * Playwright implementation of tests/features/route-protection.feature
 */
import { test, expect } from "../fixtures";
import { AuthPage } from "../helpers/auth-page";

test.describe("Route protection", () => {
  test("Unauthenticated visit to the home page redirects to login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("Authenticated visit to the login page redirects home", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("frank@example.com", "password123");
    await auth.expectOnHomePage();

    await page.goto("/login");
    await auth.expectOnHomePage();
  });

  test("Authenticated visit to the signup page redirects home", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await auth.gotoSignup();
    await auth.signup("gina@example.com", "password123");
    await auth.expectOnHomePage();

    await page.goto("/signup");
    await auth.expectOnHomePage();
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `npx playwright test tests/specs/route-protection.spec.ts`
Expected: FAIL (no middleware yet, so `/` loads without redirecting)

- [ ] **Step 4: Implement the middleware**

Create `middleware.ts` at the project root:

```ts
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session";

const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  if (!session && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();
  if (session) {
    // Sliding expiry: refresh the cookie on every authenticated request.
    const refreshedToken = await createSessionToken(session.userId);
    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshedToken,
      getSessionCookieOptions(),
    );
  }
  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup"],
};
```

- [ ] **Step 5: Run the route-protection spec to verify it passes**

Run: `npx playwright test tests/specs/route-protection.spec.ts`
Expected: 3 passed

- [ ] **Step 6: Run the full suite to confirm everything still works together**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add middleware.ts tests/features/route-protection.feature tests/specs/route-protection.spec.ts
git commit -m "Add route protection middleware"
```

---

### Task 9: Documentation & final verification

**Files:**
- Modify: `tests/README.md`

- [ ] **Step 1: Update the Gherkin → Playwright mapping table**

In `tests/README.md`, replace:

```markdown
## Gherkin → Playwright mapping

| Feature file | Spec file |
|--------------|-----------|
| `add-todo.feature` | `specs/add-todo.spec.ts` |
| `edit-todo.feature` | `specs/edit-todo.spec.ts` |
| `todo-status.feature` | `specs/todo-status.spec.ts` |
| `delete-todo.feature` | `specs/delete-todo.spec.ts` |
| `clear-completed.feature` | `specs/clear-completed.spec.ts` |
```

with:

```markdown
## Gherkin → Playwright mapping

| Feature file | Spec file |
|--------------|-----------|
| `add-todo.feature` | `specs/add-todo.spec.ts` |
| `edit-todo.feature` | `specs/edit-todo.spec.ts` |
| `todo-status.feature` | `specs/todo-status.spec.ts` |
| `delete-todo.feature` | `specs/delete-todo.spec.ts` |
| `clear-completed.feature` | `specs/clear-completed.spec.ts` |
| `signup.feature` | `specs/signup.spec.ts` |
| `login.feature` | `specs/login.spec.ts` |
| `logout.feature` | `specs/logout.spec.ts` |
| `route-protection.feature` | `specs/route-protection.spec.ts` |
| `todo-isolation.feature` | `specs/todo-isolation.spec.ts` |

Most todo-feature specs run against an authenticated test user (see
`tests/authenticated-fixtures.ts`); the auth-flow specs (signup, login,
logout, route-protection, todo-isolation) run against the plain
`tests/fixtures.ts`, since they need to control login state themselves.
```

- [ ] **Step 2: Run the full suite one final time**

Run: `npm test`
Expected: all tests pass (existing + new auth tests)

- [ ] **Step 3: Commit**

```bash
git add tests/README.md
git commit -m "Document auth test coverage in tests/README.md"
```

---

## Follow-ups (explicitly out of scope for this plan)

- Set `SESSION_SECRET` in the Vercel project's environment variables before deploying this branch to production — it's only in local `.env`/`.env.test`, which are gitignored.
- Per the design spec's non-goals: no email verification, password reset, OAuth, or rate limiting were built. Consider rate limiting on `login`/`signup` as a future hardening pass.
