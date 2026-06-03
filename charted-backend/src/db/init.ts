import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Schema applied.");
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to apply schema:", err);
  process.exit(1);
});
