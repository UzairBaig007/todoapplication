# Vercel + Turso Deployment Design

**Date:** 2026-06-10  
**Status:** Approved

## Goal

Deploy the Next.js todoapp to Vercel with Turso as the production database, while keeping SQLite for local development and CI.

## Architecture

| Environment | Adapter | Database |
|---|---|---|
| Local dev | `@prisma/adapter-better-sqlite3` | `prisma/dev.db` (local file) |
| CI (GitHub Actions) | `@prisma/adapter-better-sqlite3` | `prisma/test.db` (ephemeral) |
| Production (Vercel) | `@prisma/adapter-libsql` | Turso cloud DB |

The switch between adapters is driven entirely by the `DATABASE_URL` format:
- Starts with `libsql://` → use `@prisma/adapter-libsql` + `TURSO_AUTH_TOKEN`
- Starts with `file:` → use `@prisma/adapter-better-sqlite3`

## Code Changes

### 1. `package.json`
- Add `@libsql/client` and `@prisma/adapter-libsql` to `dependencies`
- Add `vercel-build` script: `prisma migrate deploy && next build`
  - Vercel automatically uses this script instead of `build` when present
  - Ensures migrations are applied to the Turso DB on every deploy

### 2. `lib/prisma.ts`
- Replace the hardcoded `PrismaBetterSqlite3` adapter with a factory function that reads `DATABASE_URL` and returns the correct adapter
- No changes to the rest of the app — all Prisma queries remain identical

### 3. `prisma/schema.prisma`
- No changes. `provider = "sqlite"` is compatible with both `better-sqlite3` and `libsql`/Turso

## Environment Variables

| Variable | Local | CI | Vercel (Production) |
|---|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` (in `.env`) | `file:./prisma/test.db` (in workflow) | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | not needed | not needed | token from Turso dashboard |

## External Setup Steps

1. **Turso**
   - Sign up at turso.tech
   - Create a database named `todoapp`
   - Copy the database URL (`libsql://...`) and auth token

2. **Vercel**
   - Sign up at vercel.com
   - Import the GitHub repo (`UzairBaig007/todoapp`)
   - Set `DATABASE_URL` and `TURSO_AUTH_TOKEN` as environment variables
   - Deploy — Vercel runs `vercel-build` which migrates then builds

## CI Impact

None. The GitHub Actions workflow continues to use `@prisma/adapter-better-sqlite3` with a local `test.db`. No changes to `ci.yml`.

## Out of Scope

- Authentication / per-user data
- Staging environment
- Database branching (Turso supports this but not needed now)
