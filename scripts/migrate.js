import "dotenv/config";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync("./schema.sql", "utf8");

await sql.unsafe(schema);
console.log("Migration complete");
process.exit(0);
