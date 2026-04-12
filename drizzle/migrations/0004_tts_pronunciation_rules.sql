CREATE TABLE "tts_pronunciation_rules" (
  "id" serial PRIMARY KEY,
  "pattern" text NOT NULL,
  "replacement" text NOT NULL,
  "note" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "tts_pronunciation_rules_sort_idx" ON "tts_pronunciation_rules" ("sort_order");

-- Seed with the existing hardcoded rule (移出 app/api/tts/route.ts).
INSERT INTO "tts_pronunciation_rules" ("pattern", "replacement", "note", "sort_order") VALUES
  ('職位', '職務', '「職位」被念成「學位」，改寫為「職務」讀音明確且意思相近', 0);
