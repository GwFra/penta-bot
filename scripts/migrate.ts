import "dotenv/config";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { requireEnv } from "../utils/env.js";

const sql = neon(requireEnv("DATABASE_URL"));
const schema = readFileSync("./schema.sql", "utf8");

await sql.unsafe(schema);
console.log("Migration complete");
process.exit(0);
