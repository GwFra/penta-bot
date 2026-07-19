import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";
import { requireEnv } from "../utils/env.ts";

const sql = neon(requireEnv("DATABASE_URL"));
export const db = drizzle(sql, {
  schema,
});
