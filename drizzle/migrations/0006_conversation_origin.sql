-- Add origin column to distinguish auto-saves from manual user saves.
-- Existing rows represent user-clicked saves, so default to 'manual'.
ALTER TABLE "conversations" ADD COLUMN "origin" varchar(10) NOT NULL DEFAULT 'manual';

-- Index for the rotation query (find latest auto rows per user+type)
CREATE INDEX "conversations_user_type_origin_idx"
  ON "conversations" ("user_id", "type", "origin", "saved_at" DESC);
