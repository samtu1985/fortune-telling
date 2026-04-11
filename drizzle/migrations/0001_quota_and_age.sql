-- Add age verification + purchase gate columns
ALTER TABLE "users" ADD COLUMN "birth_date" text;
ALTER TABLE "users" ADD COLUMN "age_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "can_purchase" boolean NOT NULL DEFAULT true;

-- Backfill quota for all regular approved users.
-- Exempt: admin email, ambassadors, friends.
UPDATE "users"
SET "single_credits" = 10,
    "multi_credits" = 2
WHERE "status" = 'approved'
  AND "is_ambassador" = false
  AND "is_friend" = false
  AND "email" <> 'geektu@gmail.com';
