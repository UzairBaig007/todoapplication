import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { config as loadEnv } from "dotenv";

const projectRoot = __dirname;
loadEnv({ path: path.join(projectRoot, ".env.test"), override: true });

const PORT = 3099;
const baseURL = `http://127.0.0.1:${PORT}`;
const testDatabaseUrl = `file:${path.join(projectRoot, "prisma", "test.db").replace(/\\/g, "/")}`;
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  testDir: "./tests/specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: require.resolve("./tests/global-setup.ts"),
  webServer: {
    command: `npx prisma migrate deploy && npx prisma generate && npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
