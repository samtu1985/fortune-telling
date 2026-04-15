import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

const sql = neon(process.env.POSTGRES_URL);

console.log("=== All users with credits ===");
const users = await sql`
  SELECT id, email, name, auth_provider, status,
         single_credits, multi_credits, single_used, multi_used,
         is_ambassador, is_friend,
         created_at, approved_at
  FROM users
  ORDER BY created_at DESC
`;
console.table(users);

console.log("\n=== pending_credits (unclaimed ambassador gifts) ===");
const pending = await sql`SELECT * FROM pending_credits ORDER BY created_at DESC`;
console.table(pending);
