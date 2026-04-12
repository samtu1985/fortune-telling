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

console.log("=== tts_voices (all rows) ===");
const voices = await sql`SELECT master_key, locale, voice_id FROM tts_voices ORDER BY master_key, locale`;
console.table(voices);

console.log("\n=== Expected: 3 masters × 4 locales = 12 rows ===");
const masters = ["bazi", "ziwei", "zodiac"];
const locales = ["zh-Hant", "zh-Hans", "en", "ja"];
const missing = [];
const have = new Set(voices.map((v) => `${v.master_key}|${v.locale}`));
for (const m of masters) {
  for (const l of locales) {
    if (!have.has(`${m}|${l}`)) missing.push(`${m} × ${l}`);
  }
}
console.log("Missing combinations:", missing.length === 0 ? "none" : missing);

console.log("\n=== Recent ElevenLabs api_usage for zodiac master ===");
const zodiacCalls = await sql`
  SELECT user_email, master_type, model_id, input_tokens, created_at
  FROM api_usage
  WHERE master_type = 'zodiac' AND provider = 'elevenlabs'
  ORDER BY created_at DESC
  LIMIT 10
`;
console.table(zodiacCalls);

console.log("\n=== Recent api_usage for ALL masters (TTS only) — counts by master ===");
const counts = await sql`
  SELECT master_type, COUNT(*)::int AS calls
  FROM api_usage
  WHERE provider = 'elevenlabs' AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY master_type
  ORDER BY master_type
`;
console.table(counts);
