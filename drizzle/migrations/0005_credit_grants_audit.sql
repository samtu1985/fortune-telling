-- Audit log for credit grants
CREATE TABLE "credit_grants" (
  "id" serial PRIMARY KEY,
  "sender_email" varchar(255) NOT NULL,
  "recipient_email" varchar(255) NOT NULL,
  "single_credits" integer NOT NULL DEFAULT 0,
  "multi_credits" integer NOT NULL DEFAULT 0,
  "delivery_mode" varchar(10) NOT NULL,
  "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "credit_grants_sender_idx" ON "credit_grants" ("sender_email");
CREATE INDEX "credit_grants_recipient_idx" ON "credit_grants" ("recipient_email");
CREATE INDEX "credit_grants_created_at_idx" ON "credit_grants" ("created_at");

-- Backfill: thinh.tp1990@gmail.com registered before the auto-approve
-- change and ended up stuck at 0/0 credits. Grant the standard starter
-- quota only if the row is still exactly in that stuck state.
UPDATE "users"
SET "single_credits" = 10, "multi_credits" = 2
WHERE "email" = 'thinh.tp1990@gmail.com'
  AND "status" = 'approved'
  AND "is_ambassador" = false
  AND "is_friend" = false
  AND "single_credits" = 0
  AND "multi_credits" = 0;
