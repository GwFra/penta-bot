import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { requireEnv } from "./utils/env.js";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requireEnv("DATABASE_URL"),
  },
});
