import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";

// Minimal .env.local loader (no dotenv dependency)
function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL not set");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node apply-migration.mjs <path-to-sql>");
  process.exit(1);
}

const sql = neon(url);
const contents = readFileSync(file, "utf8");

// Split on semicolons, strip SQL-style comment lines, keep non-empty statements.
const statements = contents
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter((s) => s.length > 0);

console.log(`[migrate] applying ${statements.length} statement(s) from ${file}`);
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  console.log(`\n[migrate] statement ${i + 1}/${statements.length}:`);
  console.log(stmt.slice(0, 200) + (stmt.length > 200 ? "..." : ""));
  try {
    const result = await sql.query(stmt);
    console.log(`[migrate] ✓ ok`, Array.isArray(result) ? `(${result.length} rows)` : "");
  } catch (e) {
    console.error(`[migrate] ✗ FAILED on statement ${i + 1}:`, e.message);
    process.exit(1);
  }
}
console.log("\n[migrate] all statements applied successfully");
