# E2E QA automation

## Structure

- `tests/features/` — Gherkin `.feature` files (source of truth for scenarios)
- `tests/specs/` — Playwright tests implementing each feature file
- `tests/helpers/` — Page objects and utilities
- `tests/fixtures.ts` — Shared test setup (resets DB before each test)

## Commands

```bash
npm run test      # Run all E2E tests headless
npm run test:ui   # Run tests in Playwright UI mode
```

## Test database

Tests use an isolated SQLite database at `prisma/test.db` (not `dev.db`). The app server starts on port **3099** with `DATABASE_URL` pointing to the test database.

## Gherkin → Playwright mapping

| Feature file | Spec file |
|--------------|-----------|
| `add-todo.feature` | `specs/add-todo.spec.ts` |
| `edit-todo.feature` | `specs/edit-todo.spec.ts` |
| `todo-status.feature` | `specs/todo-status.spec.ts` |
| `delete-todo.feature` | `specs/delete-todo.spec.ts` |
| `clear-completed.feature` | `specs/clear-completed.spec.ts` |
