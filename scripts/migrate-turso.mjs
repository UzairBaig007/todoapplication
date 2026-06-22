import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("DATABASE_URL must be a libsql:// URL");
  process.exit(1);
}

const client = createClient({ url, authToken });

const migrations = [
  "prisma/migrations/20260604124018_init/migration.sql",
  "prisma/migrations/20260604125615_add_todo_note/migration.sql",
  "prisma/migrations/20260604131000_replace_completed_with_status/migration.sql",
  "prisma/migrations/20260617083447_add_user_auth/migration.sql",
];

for (const migrationPath of migrations) {
  const sql = readFileSync(join(process.cwd(), migrationPath), "utf-8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Applying ${migrationPath}...`);
  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (err) {
      if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
        console.log(`  Skipped (already exists): ${statement.slice(0, 50)}...`);
      } else {
        console.error(`  Error: ${err.message}`);
        console.error(`  Statement: ${statement}`);
      }
    }
  }
  console.log(`  Done.`);
}

console.log("All migrations applied.");
client.close();
