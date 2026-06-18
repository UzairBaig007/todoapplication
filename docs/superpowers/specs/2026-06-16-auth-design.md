# Auth (Signup & Login) — Design Spec

**Date:** 2026-06-16
**Status:** Approved for planning

## Summary

Add account-based authentication (signup, login, logout) to the todo app.
Todos become per-user: each account has its own private todo list instead
of the current shared global list.

## Goals

- Users can sign up with a unique, valid-format email and a password of at
  least 8 characters.
- Passwords are hashed before storage, never stored or transmitted in
  plain text.
- Users can log in with valid credentials and are rejected (with a clear,
  generic error) on invalid ones.
- Successful signup/login creates a session and lands the user on the main
  app page (`/`).
- Sessions expire after 7 days (sliding expiry — refreshed on activity).
- Unauthenticated users cannot reach `/`; authenticated users are bounced
  away from `/login` and `/signup`.
- Each user only ever sees/modifies their own todos.
- Logout is included, clearing the session.

## Non-Goals

- Email verification.
- Password reset / "forgot password" flow.
- OAuth / social login.
- Multi-device session management UI (e.g. "log out everywhere").
- Rate limiting / brute-force protection (could be a future hardening pass).

## Data Model

```prisma
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

`dev.db` will be reset/regenerated against the new schema rather than
migrating the existing ownerless demo todos (they're throwaway local/test
data).

## Libraries

- **Password hashing:** `bcryptjs` — pure JS, no native compilation step,
  avoids the native-binary issues `bcrypt`/`argon2` can hit on Vercel
  serverless deploys (this project already deploys there).
- **Session token:** `jose` to sign/encrypt a JWT containing `{ userId, exp }`,
  stored in an HTTP-only, `Secure`, `SameSite=Lax` cookie. No new auth
  framework (Auth.js was considered and rejected as more setup than this
  app needs for simple email+password auth).

## Auth Flow

### Signup (`signup(email, password)` server action)
1. Validate email format and password length (≥ 8 chars) — server-side,
   in addition to client-side checks.
2. Check email uniqueness; if taken, return
   `{ ok: false, error: "Email already in use" }`.
3. Hash password with `bcryptjs`, create the `User` row.
4. Issue a session cookie, redirect to `/`.

### Login (`login(email, password)` server action)
1. Look up the user by email; compare password against `passwordHash`.
2. On any failure (no such user, or wrong password), return a **generic**
   `{ ok: false, error: "Invalid email or password" }` — never reveal which
   field was wrong.
3. On success, issue a session cookie, redirect to `/`.

### Logout (`logout()` server action)
- Clears the session cookie, redirects to `/login`.

## Route Protection

`middleware.ts` inspects the session cookie on every request:
- No/invalid session + request to `/` → redirect to `/login`.
- Valid session + request to `/login` or `/signup` → redirect to `/`.

All existing todo server actions (`createTodo`, `updateTodo`,
`updateTodoStatus`, `deleteTodo`, `clearCompletedTodos`) read `userId` from
the session and scope every Prisma query to that user, so no todo can be
read, edited, or deleted across accounts.

## Pages

- `/signup` — email + password fields, "Sign Up" button, link to `/login`.
- `/login` — email + password fields, "Login" button, link to `/signup`.
- App header gets a "Logout" button (calls the `logout` action) for
  authenticated users.

## Validation & Error Handling

- **Client-side:** HTML5 + inline messages for empty fields, invalid email
  format, and password < 8 chars, shown without a round trip.
- **Server-side:** the same validations are always re-checked, since
  server actions can be invoked directly and must not trust client input.
- **Password field:** standard `type="password"` input (native masking).
- **Login errors:** generic "Invalid email or password", shown inline,
  password field cleared on error, email preserved.
- **Signup errors:** specific messages are fine here ("Email already in
  use", "Password must be at least 8 characters") since this isn't a
  public-facing app where account-existence leaks are a major concern.
- **Transport:** HTTPS is handled by the Vercel deployment; the session
  cookie is marked `Secure` so it's never sent over plain HTTP in
  production.
- Responsive/cross-browser support comes from the existing Tailwind setup;
  no special handling needed beyond standard responsive form layout.

## Testing Plan (Playwright)

- **Signup:** valid signup logs the user in and redirects to `/`; duplicate
  email rejected; invalid email format rejected; password < 8 chars
  rejected.
- **Login:** valid credentials redirect to `/`; invalid credentials show an
  error and stay on `/login`; empty field submission blocked.
- **Route protection:** logged-out visit to `/` redirects to `/login`;
  logged-in visit to `/login` or `/signup` redirects to `/`.
- **Logout:** clears the session; subsequent visit to `/` redirects to
  `/login`.
- **Per-user isolation:** two distinct accounts each only see their own
  todos.
- The existing test reset helper (`app/api/test/reset/route.ts`) will be
  extended to also reset/seed users for test isolation.
