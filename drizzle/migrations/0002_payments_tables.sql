-- drizzle/migrations/0002_payments_tables.sql

CREATE TABLE "payment_packages" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "buy_button_id" text NOT NULL,
  "publishable_key" text NOT NULL,
  "stripe_price_id" text,
  "price_amount" integer,
  "currency" varchar(10) NOT NULL DEFAULT 'hkd',
  "single_credits_granted" integer NOT NULL DEFAULT 0,
  "multi_credits_granted" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "purchases" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "package_id" integer REFERENCES "payment_packages"("id"),
  "stripe_session_id" text NOT NULL UNIQUE,
  "stripe_payment_intent_id" text,
  "amount" integer NOT NULL,
  "currency" varchar(10) NOT NULL,
  "single_granted" integer NOT NULL,
  "multi_granted" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "purchases_user_id_idx" ON "purchases" ("user_id");
CREATE INDEX "purchases_created_at_idx" ON "purchases" ("created_at");
CREATE INDEX "purchases_stripe_payment_intent_idx" ON "purchases" ("stripe_payment_intent_id");

CREATE TABLE "stripe_events" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now()
);
