import "dotenv/config";
import { defineConfig } from "prisma/config";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    adapter: () => {
      const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
      if (url.startsWith("libsql://") || url.startsWith("file:")) {
        const client = createClient({
          url,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        return new PrismaLibSql(client);
      }
      throw new Error(`Unsupported DATABASE_URL scheme: ${url}`);
    },
  },
});
