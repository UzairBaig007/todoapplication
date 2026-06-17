# Signup / Login Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user signup/login with JWT sessions so each user only sees their own todos.

**Architecture:** Custom JWT sessions using `jose` (signed HttpOnly cookies) + `bcryptjs` for password hashing. Route protection via `proxy.ts` (Next.js 16's replacement for middleware). Server Actions handle auth logic; a DAL `verifySession()` function scopes all data access.

**Tech Stack:** Next.js 16 App Router, React 19 `useActionState`, Prisma/SQLite, `jose` (JWT), `bcryptjs`, `proxy.ts`

> **Note:** NextAuth.js was originally considered but is not used here because `middleware.ts` is deprecated in Next.js 16 (replaced by `proxy.ts`) and NextAuth's compatibility with Next.js 16 is unconfirmed. The custom approach using `jose` is what the Next.js 16 official docs recommend.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `User` model; add `userId` FK to `Todo` |
| `lib/session.ts` | Create | JWT encrypt/decrypt, createSession, deleteSession |
| `lib/dal.ts` | Create | `verifySession()` — reads session cookie, redirects if missing |
| `app/actions/auth.ts` | Create | `signup`, `login`, `logout` server actions |
| `proxy.ts` | Create | Protect `/` (redirect to `/login`); redirect authed users away from `/login`+`/signup` |
| `app/login/page.tsx` | Create | Login page (server component shell) |
| `app/login/LoginForm.tsx` | Create | Client form with `useActionState` |
| `app/signup/page.tsx` | Create | Signup page (server component shell) |
| `app/signup/SignupForm.tsx` | Create | Client form with `useActionState` |
| `app/page.tsx` | Modify | Show user email + Sign Out button in header |
| `app/actions.ts` | Modify | Scope all Prisma queries to `verifySession().userId` |
| `app/components/TodoList.tsx` | Modify | Remove unscoped `prisma.todo.findMany`; use session-scoped query |
| `app/api/test/reset/route.ts` | Modify | Also delete users; create test user; return session token |
| `tests/helpers/reset.ts` | Modify | Accept and return session token from reset response |
| `tests/fixtures.ts` | Modify | Set session cookie from token returned by reset |
| `tests/helpers/todo-page.ts` | Modify | Update `goto()` to not assert heading (it now waits for redirect to settle) |
| `tests/specs/auth.spec.ts` | Create | Playwright tests for signup, login, logout, and data isolation |
| `.env` | Modify | Add `SESSION_SECRET` |
| `.env.test` | Modify | Add `SESSION_SECRET` |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install jose bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Verify installation**

```bash
npm ls jose bcryptjs
```

Expected output includes `jose@x.x.x` and `bcryptjs@x.x.x` with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(auth): install jose and bcryptjs"
```

---

## Task 2: Add SESSION_SECRET to environment files

**Files:** `.env`, `.env.test`

- [ ] **Step 1: Generate a secret**

Run this in your terminal to generate a 32-byte base64 secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output — you'll use it in the next step.

- [ ] **Step 2: Add to `.env`**

Open `.env` (create it if it doesn't exist) and add:

```bash
SESSION_SECRET=<paste-your-generated-secret-here>
```

- [ ] **Step 3: Add to `.env.test`**

Open `.env.test` and add the same key (can use the same value for tests):

```bash
SESSION_SECRET=test-secret-do-not-use-in-production-32ch
```

- [ ] **Step 4: Commit**

```bash
git add .env.test
git commit -m "feat(auth): add SESSION_SECRET to test env"
```

> Do NOT commit `.env` — it should already be in `.gitignore`.

---

## Task 3: Update Prisma schema

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Update the schema**

Replace the entire contents of `prisma/schema.prisma` with:

```prisma
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
  id        Int        @id @default(autoincrement())
  email     String     @unique
  password  String
  createdAt DateTime   @default(now())
  todos     Todo[]
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

- [ ] **Step 2: Reset the dev database and create migration**

> **Warning:** This deletes all existing todos in your dev database. That's fine — they have no userId and can't be migrated.

```bash
npx prisma migrate reset --force
npx prisma migrate dev --name add-user-auth
```

Expected: Migration created and applied. `prisma generate` runs automatically.

- [ ] **Step 3: Verify generated types include User**

```bash
node -e "const { PrismaClient } = require('./app/generated/prisma/client'); console.log('User model exists:', typeof PrismaClient)"
```

Expected: prints without error.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(auth): add User model and userId FK to Todo"
```

---

## Task 4: Create session management library

**Files:** Create `lib/session.ts`

- [ ] **Step 1: Create `lib/session.ts`**

```typescript
import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function encrypt(payload: { userId: number; expiresAt: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey())
}

export async function decrypt(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    })
    return payload as { userId: number; expiresAt: string }
  } catch {
    return null
  }
}

export async function createSession(userId: number) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ userId, expiresAt: expiresAt.toISOString() })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
  return token
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionToken() {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `lib/session.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/session.ts
git commit -m "feat(auth): add JWT session management"
```

---

## Task 5: Create Data Access Layer (DAL)

**Files:** Create `lib/dal.ts`

- [ ] **Step 1: Create `lib/dal.ts`**

```typescript
import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { decrypt, getSessionToken } from '@/lib/session'

export const verifySession = cache(async () => {
  const token = await getSessionToken()
  const session = await decrypt(token)

  if (!session?.userId) {
    redirect('/login')
  }

  return { userId: session.userId }
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/dal.ts
git commit -m "feat(auth): add verifySession DAL"
```

---

## Task 6: Create auth server actions

**Files:** Create `app/actions/auth.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p app/actions
```

Create `app/actions/auth.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'

export type AuthState =
  | { errors?: { email?: string[]; password?: string[]; confirmPassword?: string[] }; message?: string }
  | undefined

export async function signup(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

  const errors: AuthState['errors'] = {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['Please enter a valid email address.']
  }
  if (password.length < 8) {
    errors.password = ['Password must be at least 8 characters.']
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = ['Passwords do not match.']
  }

  if (Object.keys(errors).length > 0) return { errors }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ['An account with this email already exists.'] } }
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, password: hashedPassword } })

  await createSession(user.id)
  redirect('/')
}

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { message: 'Invalid email or password.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    return { message: 'Invalid email or password.' }
  }

  await createSession(user.id)
  redirect('/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/auth.ts
git commit -m "feat(auth): add signup, login, logout server actions"
```

---

## Task 7: Create proxy.ts for route protection

**Files:** Create `proxy.ts` in project root

- [ ] **Step 1: Create `proxy.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/']
const publicRoutes = ['/login', '/signup']

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.includes(path)
  const isPublicRoute = publicRoutes.includes(path)

  const token = req.cookies.get('session')?.value
  const session = await decrypt(token)

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublicRoute && session?.userId) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(auth): add proxy route protection"
```

---

## Task 8: Create login page and form

**Files:** Create `app/login/page.tsx`, create `app/login/LoginForm.tsx`

- [ ] **Step 1: Create `app/login/LoginForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login, type AuthState } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.message && (
        <p data-testid="auth-error" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          data-testid="email-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          data-testid="password-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.password && (
          <p className="text-xs text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        data-testid="submit-button"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign In'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-foreground underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```tsx
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-sm">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign In</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back to My Todo App.</p>
        </header>
        <LoginForm />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/login/
git commit -m "feat(auth): add login page and form"
```

---

## Task 9: Create signup page and form

**Files:** Create `app/signup/page.tsx`, create `app/signup/SignupForm.tsx`

- [ ] **Step 1: Create `app/signup/SignupForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup, type AuthState } from '@/app/actions/auth'

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.message && (
        <p data-testid="auth-error" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          data-testid="email-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          data-testid="password-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.password && (
          <p className="text-xs text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          data-testid="confirm-password-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.confirmPassword && (
          <p className="text-xs text-red-600">{state.errors.confirmPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        data-testid="submit-button"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/signup/page.tsx`**

```tsx
import { SignupForm } from './SignupForm'

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-sm">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create Account</h1>
          <p className="mt-1 text-sm text-zinc-500">Start managing your todos.</p>
        </header>
        <SignupForm />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/signup/
git commit -m "feat(auth): add signup page and form"
```

---

## Task 10: Update home page with user info and sign out

**Files:** Modify `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { TodoForm } from './components/TodoForm'
import { TodoList } from './components/TodoList'
import { verifySession } from '@/lib/dal'
import { logout } from './actions/auth'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  const { userId } = await verifySession()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) redirect('/login')

  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-lg">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              My Todo App
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage tasks with status, notes, and editing.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span data-testid="user-email" className="text-xs text-zinc-500">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                data-testid="sign-out-button"
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-foreground"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <section className="mb-6">
          <TodoForm />
        </section>

        <section>
          <TodoList />
        </section>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(auth): show user email and sign out on home page"
```

---

## Task 11: Scope todo server actions to the logged-in user

**Files:** Modify `app/actions.ts`

- [ ] **Step 1: Replace `app/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { isTodoStatus, type TodoStatus } from '@/lib/todo'

export async function createTodo(formData: FormData) {
  const { userId } = await verifySession()
  const title = formData.get('title')?.toString().trim()
  if (!title) return

  const note = formData.get('note')?.toString().trim() || null

  await prisma.todo.create({
    data: { title, note, userId },
  })
  revalidatePath('/')
}

export async function updateTodoStatus(id: number, status: string) {
  const { userId } = await verifySession()
  if (!isTodoStatus(status)) return

  await prisma.todo.update({
    where: { id, userId },
    data: { status: status as TodoStatus },
  })
  revalidatePath('/')
}

export async function updateTodo(
  id: number,
  title: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession()
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return { ok: false, error: 'Title cannot be empty' }
  }

  const trimmedNote = note?.trim() || null

  await prisma.todo.update({
    where: { id, userId },
    data: { title: trimmedTitle, note: trimmedNote },
  })
  revalidatePath('/')
  return { ok: true }
}

export async function deleteTodo(id: number) {
  const { userId } = await verifySession()
  await prisma.todo.delete({ where: { id, userId } })
  revalidatePath('/')
}

export async function clearCompletedTodos() {
  const { userId } = await verifySession()
  await prisma.todo.deleteMany({
    where: { status: 'done', userId },
  })
  revalidatePath('/')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions.ts
git commit -m "feat(auth): scope all todo actions to logged-in user"
```

---

## Task 12: Scope TodoList query to the logged-in user

**Files:** Modify `app/components/TodoList.tsx`

- [ ] **Step 1: Replace `app/components/TodoList.tsx`**

```tsx
import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { ClearCompletedButton } from './ClearCompletedButton'
import { FilterableTodoList } from './FilterableTodoList'

export async function TodoList() {
  await connection()
  const { userId } = await verifySession()

  const [todos, doneCount] = await Promise.all([
    prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.todo.count({
      where: { status: 'done', userId },
    }),
  ])

  if (todos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No todos yet. Add one above!
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ClearCompletedButton count={doneCount} />
      </div>
      <FilterableTodoList todos={todos} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/TodoList.tsx
git commit -m "feat(auth): scope TodoList query to logged-in user"
```

---

## Task 13: Update test reset endpoint to support auth

**Files:** Modify `app/api/test/reset/route.ts`

The reset endpoint now needs to:
1. Delete all todos
2. Delete all users
3. Create a test user (`test@example.com`)
4. Create a session JWT for that user
5. Return the token so the test fixture can set the cookie

- [ ] **Step 1: Replace `app/api/test/reset/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/session'

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'TestPass123!'

function isTestDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  return url.includes('test.db')
}

export async function POST() {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12)
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, password: hashedPassword },
  })

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const sessionToken = await encrypt({ userId: user.id, expiresAt: expiresAt.toISOString() })

  return NextResponse.json({ ok: true, sessionToken, expiresAt: expiresAt.toISOString() })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/test/reset/route.ts
git commit -m "feat(auth): update test reset to create user and return session token"
```

---

## Task 14: Update test helpers and fixture for auth

**Files:** Modify `tests/helpers/reset.ts`, modify `tests/fixtures.ts`, modify `tests/helpers/todo-page.ts`

- [ ] **Step 1: Replace `tests/helpers/reset.ts`**

```typescript
import type { APIRequestContext } from '@playwright/test'

export interface ResetResult {
  sessionToken: string
  expiresAt: string
}

export async function resetAndGetSession(request: APIRequestContext, baseURL: string): Promise<ResetResult> {
  const response = await request.post(`${baseURL}/api/test/reset`)
  if (!response.ok()) {
    throw new Error(`Failed to reset: ${response.status()} ${await response.text()}`)
  }
  const data = await response.json()
  return { sessionToken: data.sessionToken, expiresAt: data.expiresAt }
}
```

- [ ] **Step 2: Replace `tests/fixtures.ts`**

```typescript
import path from 'path'
import { config as loadEnv } from 'dotenv'
import { test as base } from '@playwright/test'
import { resetAndGetSession } from './helpers/reset'

const projectRoot = path.resolve(__dirname, '..')
loadEnv({ path: path.join(projectRoot, '.env.test'), override: true })

export const test = base.extend({
  page: async ({ page, request, baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is required for E2E tests')
    }
    const { sessionToken, expiresAt } = await resetAndGetSession(request, baseURL)
    await page.context().addCookies([
      {
        name: 'session',
        value: sessionToken,
        domain: new URL(baseURL).hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        expires: Math.floor(new Date(expiresAt).getTime() / 1000),
      },
    ])
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 3: Update `tests/helpers/todo-page.ts` — update `goto()`**

Replace just the `goto()` method (lines 6–9) with:

```typescript
  async goto() {
    await this.page.goto('/')
    await this.page.waitForURL('/')
    await expect(this.page.getByRole('heading', { name: 'My Todo App' })).toBeVisible()
  }
```

> The full file with only this method changed:

```typescript
import { expect, type Locator, type Page } from '@playwright/test'

export class TodoPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/')
    await this.page.waitForURL('/')
    await expect(this.page.getByRole('heading', { name: 'My Todo App' })).toBeVisible()
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/reset.ts tests/fixtures.ts tests/helpers/todo-page.ts
git commit -m "feat(auth): update test fixtures for authenticated test sessions"
```

---

## Task 15: Write Playwright auth tests

**Files:** Create `tests/specs/auth.spec.ts`

- [ ] **Step 1: Create `tests/specs/auth.spec.ts`**

```typescript
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

  test('signup with valid credentials auto-logs in and redirects to /', async ({ browser, request, baseURL }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await page.getByTestId('email-input').fill('newuser@example.com')
    await page.getByTestId('password-input').fill('NewPass123!')
    await page.getByTestId('confirm-password-input').fill('NewPass123!')
    await page.getByTestId('submit-button').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'My Todo App' })).toBeVisible()
    await context.close()
  })

  test('signup shows error when passwords do not match', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/signup')
    await page.getByTestId('email-input').fill('user@example.com')
    await page.getByTestId('password-input').fill('Password123!')
    await page.getByTestId('confirm-password-input').fill('Different123!')
    await page.getByTestId('submit-button').click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    await context.close()
  })

  test('signup shows error when email already exists', async ({ page }) => {
    await page.goto('/signup')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('Password123!')
    await page.getByTestId('confirm-password-input').fill('Password123!')
    await page.getByTestId('submit-button').click()
    await expect(page.getByText('An account with this email already exists.')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'My Todo App' })).toBeVisible()
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
  test('user A cannot see user B todos', async ({ page, browser, request, baseURL }) => {
    // User A (test@example.com from fixture) adds a todo
    await page.goto('/')
    await page.getByTestId('todo-title-input').fill('User A secret todo')
    await page.getByTestId('todo-add-button').click()
    await expect(page.locator('[data-testid="todo-item"]', { hasText: 'User A secret todo' })).toBeVisible()

    // User B signs up in a separate context
    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    await pageB.goto('/signup')
    await pageB.getByTestId('email-input').fill('userb@example.com')
    await pageB.getByTestId('password-input').fill('UserBPass123!')
    await pageB.getByTestId('confirm-password-input').fill('UserBPass123!')
    await pageB.getByTestId('submit-button').click()
    await expect(pageB).toHaveURL('/')

    // User B should not see User A's todo
    await expect(pageB.locator('[data-testid="todo-item"]', { hasText: 'User A secret todo' })).toHaveCount(0)
    await ctxB.close()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/specs/auth.spec.ts
git commit -m "feat(auth): add Playwright auth tests"
```

---

## Task 16: Run the full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Deploy test migration**

```bash
npx prisma migrate deploy
```

Run with test env:
```bash
$env:DATABASE_URL="file:./prisma/test.db"; npx prisma migrate deploy
```

Or on Mac/Linux:
```bash
DATABASE_URL="file:./prisma/test.db" npx prisma migrate deploy
```

Expected: migration applied to test.db.

- [ ] **Step 2: Run all Playwright tests**

```bash
npm test
```

Expected: all tests pass (23 original + new auth tests). Any failures should be investigated before marking this complete.

- [ ] **Step 3: Verify TypeScript with tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(auth): complete signup/login implementation with per-user todo isolation"
```
