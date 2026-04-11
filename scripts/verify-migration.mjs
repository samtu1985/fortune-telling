import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";

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

const sql = neon(process.env.POSTGRES_URL);

const cols = await sql`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name IN ('birth_date', 'age_verified_at', 'can_purchase')
  ORDER BY column_name
`;
console.log("New columns on users:");
console.table(cols);

const counts = await sql`
  SELECT
    COUNT(*) FILTER (WHERE status = 'approved' AND is_ambassador = false AND is_friend = false AND email <> 'geektu@gmail.com') AS regular_approved,
    COUNT(*) FILTER (WHERE status = 'approved' AND single_credits = 10 AND multi_credits = 2 AND is_ambassador = false AND is_friend = false AND email <> 'geektu@gmail.com') AS regular_backfilled_to_10_2,
    COUNT(*) FILTER (WHERE is_ambassador = true) AS ambassadors,
    COUNT(*) FILTER (WHERE is_friend = true) AS friends,
    COUNT(*) FILTER (WHERE email = 'geektu@gmail.com') AS admin,
    COUNT(*) FILTER (WHERE age_verified_at IS NULL) AS unverified_age,
    COUNT(*) FILTER (WHERE can_purchase = true) AS can_purchase_true,
    COUNT(*) AS total
  FROM users
`;
console.log("\nUser counts:");
console.table(counts);
