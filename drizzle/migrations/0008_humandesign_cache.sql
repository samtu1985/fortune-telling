-- Cache for humandesignhub API responses to avoid 6 cr / call cost on repeats.
-- cache_key = sha256(date|time|city|calendarType-after-lunar-to-solar-conversion).
-- chart_data and image_base64 are independently nullable: each fetch path populates only
-- the column it needs; future calls reuse whatever's already in the row.
CREATE TABLE "humandesign_cache" (
  "cache_key" varchar(64) PRIMARY KEY NOT NULL,
  "chart_data" jsonb,
  "image_base64" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "humandesign_cache_last_used_idx" ON "humandesign_cache" ("last_used_at");
