# Signup / Login Authentication — Design Spec

**Date:** 2026-06-17  
**Status:** Approved

## Overview

Add per-user authentication to the todo app using NextAuth.js (Auth.js) with a Credentials provider and JWT sessions. Each user sees only their own todos. No third-party OAuth providers in this phase.

---

## Data Model

Add a `User` model and link `Todo` to it via a foreign key.

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  todos     Todo[]
}

model Todo {
  id        Int        @id @default(autoincrement())
  title     String
  note      String?
  status    TodoStatus @default(pending)
  createdAt DateTime   @default(now())
  userId    Int
  user      User       @relation(fields: [userId], references: [id])
}
```

- `password` stores a bcrypt hash — never plaintext
- `userId` is required on every todo; no orphan todos allowed

---

## Pages & Routing

| Route | Description |
|-------|-------------|
| `/signup` | Email + password + confirm password form. On success: create user, auto sign-in, redirect to `/` |
| `/login` | Email + password form. On success: sign in, redirect to `/` |
| `/` | Protected. Unauthenticated users redirect to `/login`. Shows logged-in user's email and Sign Out button in header |

**Middleware (`middleware.ts`):** Runs on every request. Checks NextAuth session cookie. Redirects unauthenticated users to `/login`. Redirects authenticated users away from `/login` and `/signup` to `/`.

---

## Auth Flow

### Signup
1. User submits email + password + confirm password
2. Server action validates: valid email format, password ≥ 8 characters, passwords match
3. Check email not already taken — return error if so
4. Hash password with `bcryptjs`
5. Create `User` in DB
6. Call `signIn('credentials', { email, password })` automatically
7. Redirect to `/`

### Login
1. User submits email + password
2. NextAuth Credentials provider looks up user by email
3. `bcrypt.compare()` verifies password
4. On match: JWT session cookie set, redirect to `/`

### Sign Out
1. User clicks Sign Out in header
2. `signOut()` called — JWT cookie cleared
3. Redirect to `/login`

### Todo Scoping
All server actions read `userId` from the NextAuth session (`getServerSession()`). Every Prisma query includes `where: { userId }`. A user cannot read, modify, or delete another user's todos.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Email already registered (signup) | Inline error: "An account with this email already exists" |
| Passwords don't match (signup) | Inline error: "Passwords do not match" |
| Password too short (signup) | Inline error: "Password must be at least 8 characters" |
| Wrong email or password (login) | Generic error: "Invalid email or password" (no hint which is wrong) |
| Unauthenticated access to `/` | Redirect to `/login` |
| Authenticated access to `/login` or `/signup` | Redirect to `/` |
| Session expiry (30-day JWT default) | On next request, redirect to `/login` |

---

## Session

- **Strategy:** JWT (no DB session table)
- **Expiry:** 30 days (NextAuth default)
- **Session contains:** `user.id` and `user.email`
- **Access in server actions:** via `getServerSession(authOptions)`

---

## Dependencies to Add

- `next-auth` — authentication framework
- `bcryptjs` + `@types/bcryptjs` — password hashing

---

## Out of Scope

- OAuth providers (Google, GitHub)
- Password reset / forgot password
- Email verification
- Account deletion
