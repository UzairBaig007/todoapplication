import path from "path";
import { config as loadEnv } from "dotenv";
import { test as base } from "@playwright/test";
import { resetTodos } from "./helpers/reset";

const projectRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(projectRoot, ".env.test"), override: true });

export const test = base.extend({
  page: async ({ page, request, baseURL }, use) => {
    if (!baseURL) {
      throw new Error("baseURL is required for E2E tests");
    }
    await resetTodos(request, baseURL);
    await use(page);
  },
});

export { expect } from "@playwright/test";
