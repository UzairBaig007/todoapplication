# Vercel + Turso Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the todoapp to Vercel with Turso as the production database while keeping SQLite for local dev and CI.

**Architecture:** The Prisma client factory in `lib/prisma.ts` reads `DATABASE_URL` at startup and selects the appropriate adapter — `@prisma/adapter-libsql` when the URL starts with `libsql://` (Turso/Vercel), `@prisma/adapter-better-sqlite3` otherwise (local/CI). No other files change.

**Tech Stack:** Next.js 16, Prisma 7, `@prisma/adapter-libsql`, `@libsql/client`, `@prisma/adapter-better-sqlite3`, Turso (hosted libsql), Vercel

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `@libsql/client` + `@prisma/adapter-libsql` to dependencies; add `vercel-build` script |
| `lib/prisma.ts` | Replace hardcoded adapter with URL-based factory |
| `prisma/schema.prisma` | No change |
| `.github/workflows/ci.yml` | No change |

---

## Task 1: Install libsql packages and add vercel-build script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the two new packages**

Run in the project root:
```bash
npm install @libsql/client @prisma/adapter-libsql
```

Expected: packages added to `node_modules`, `package.json` dependencies updated, `package-lock.json` updated.

- [ ] **Step 2: Add the vercel-build script to package.json**

Open `package.json` and add `vercel-build` to the `scripts` section. The final scripts block must look exactly like this:

```json
"scripts": {
  "dev": "prisma generate && next dev",
  "dev:reset": "prisma generate && node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\" && next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "postinstall": "prisma generate",
  "test": "playwright test",
  "test:ui": "playwright test --ui",
  "vercel-build": "prisma migrate deploy && next build"
},
```

- [ ] **Step 3: Run the existing test suite to verify nothing broke**

```bash
npm test
```

Expected: `23 passed` — all tests green. If any fail, do not continue.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add libsql packages and vercel-build script"
```

---

## Task 2: Update lib/prisma.ts to support both adapters

**Files:**
- Modify: `lib/prisma.ts`

- [ ] **Step 1: Replace the entire contents of lib/prisma.ts**

```ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (databaseUrl.startsWith("libsql://")) {
    const client = createClient({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(client);
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Run the test suite to verify the SQLite path still works**

```bash
npm test
```

Expected: `23 passed`. The tests exercise the SQLite path (`file:` URL), so all green means the existing adapter branch is intact.

- [ ] **Step 3: Commit**

```bash
git add lib/prisma.ts
git commit -m "feat: switch prisma adapter based on DATABASE_URL prefix"
```

- [ ] **Step 4: Push both commits to GitHub**

```bash
git push origin main
```

Expected: push succeeds, GitHub Actions CI run starts automatically. Wait for it to go green before continuing.

---

## Task 3: Create Turso account and database

> This is a manual task done in the browser / terminal. No code changes.

- [ ] **Step 1: Sign up at turso.tech**

Go to https://turso.tech and create a free account. Verify your email.

- [ ] **Step 2: Create a database**

In the Turso dashboard, click **Create Database**. Name it `todoapp`, choose the region closest to you (e.g. `ams` for Europe, `iad` for US East). Click **Create**.

- [ ] **Step 3: Copy the database URL**

Inside the database page, click **Connect** → **libsql URL**. Copy the value — it looks like:
```
libsql://todoapp-<yourname>.turso.io
```
Save this somewhere (Notepad, notes app). You will paste it into Vercel.

- [ ] **Step 4: Generate an auth token**

On the same Connect screen, click **Generate Token** (or **Create Token**). Copy the token string. Save it alongside the URL.

> The token is shown only once. If you lose it, generate a new one.

---

## Task 4: Create Vercel project and deploy

> This is a manual task done in the browser. No code changes.

- [ ] **Step 1: Sign up at vercel.com**

Go to https://vercel.com and create a free account. Choose **Continue with GitHub** and authorize Vercel to access your repositories.

- [ ] **Step 2: Import the GitHub repository**

From the Vercel dashboard, click **Add New → Project**. Find `todoapplication` in the repository list (from `UzairBaig007`). Click **Import**.

- [ ] **Step 3: Set environment variables**

Before clicking Deploy, scroll to the **Environment Variables** section. Add these two variables (both for Production, Preview, and Development):

| Name | Value |
|---|---|
| `DATABASE_URL` | `libsql://todoapp-<yourname>.turso.io` (the URL from Task 3 Step 3) |
| `TURSO_AUTH_TOKEN` | the token from Task 3 Step 4 |

- [ ] **Step 4: Deploy**

Click **Deploy**. Vercel will:
1. Run `npm ci` (triggers `postinstall` → `prisma generate`)
2. Run `vercel-build` = `prisma migrate deploy && next build`
   - `prisma migrate deploy` applies your 3 migrations to the Turso DB
   - `next build` compiles the app

Watch the build log. Expected finish: **Build Completed** with a green tick.

- [ ] **Step 5: Verify the live app**

Click the deployment URL (e.g. `https://todoapplication-abc123.vercel.app`). Confirm:
- The todo list loads
- You can create a todo
- You can mark it complete
- You can delete it
- Search and filter work

If anything fails, check the Vercel **Functions** log tab for runtime errors.
