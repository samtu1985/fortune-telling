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

console.log("=== Package ===");
console.table(await sql`SELECT id, name, single_credits_granted, multi_credits_granted, stripe_price_id, is_active FROM payment_packages`);

console.log("\n=== Purchases (most recent first) ===");
console.table(await sql`
  SELECT id, user_id, package_id, single_granted, multi_granted, amount, status, created_at
  FROM purchases
  ORDER BY created_at DESC
  LIMIT 10
`);

console.log("\n=== Users with purchases ===");
console.table(await sql`
  SELECT u.id, u.email, u.single_credits, u.multi_credits, u.single_used, u.multi_used,
         (u.single_credits - u.single_used) AS single_remaining,
         (u.multi_credits - u.multi_used) AS multi_remaining,
         u.is_ambassador, u.is_friend
  FROM users u
  WHERE u.id IN (SELECT DISTINCT user_id FROM purchases)
  ORDER BY u.id
`);

console.log("\n=== Stripe events ===");
console.table(await sql`
  SELECT id, type, processed_at
  FROM stripe_events
  ORDER BY processed_at DESC
  LIMIT 10
`);
