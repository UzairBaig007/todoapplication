import "dotenv/config";
import { defineConfig } from "prisma/config";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: url.startsWith("libsql://")
    ? {
        adapter: () => {
          const client = createClient({
            url,
            authToken: process.env.TURSO_AUTH_TOKEN,
          });
          return new PrismaLibSql(client);
        },
      }
    : { url },
});
