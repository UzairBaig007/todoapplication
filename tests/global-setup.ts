import { execSync } from "child_process";
import path from "path";
import { config as loadEnv } from "dotenv";

const projectRoot = path.resolve(__dirname, "..");
const testDatabaseUrl = `file:${path.join(projectRoot, "prisma", "test.db").replace(/\\/g, "/")}`;

export default async function globalSetup() {
  loadEnv({ path: path.join(projectRoot, ".env.test"), override: true });

  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
  });
}
