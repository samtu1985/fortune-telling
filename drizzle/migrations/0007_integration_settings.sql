-- Third-party service integrations (calculation APIs, etc.)
-- Keys are stored encrypted via the same AES-256-GCM helper as ai_settings.
CREATE TABLE "integration_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "service" varchar(50) NOT NULL,
  "api_url" text NOT NULL,
  "api_key_encrypted" text DEFAULT '' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_settings_service_unique" UNIQUE("service")
);
