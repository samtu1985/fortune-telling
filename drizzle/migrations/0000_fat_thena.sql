CREATE TABLE "ai_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_key" varchar(30) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"api_key_encrypted" text DEFAULT '' NOT NULL,
	"api_url" text NOT NULL,
	"thinking_mode" varchar(20),
	"effort" varchar(10),
	"thinking_budget" integer,
	"reasoning_depth" varchar(10),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_master_key_unique" UNIQUE("master_key")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(10) NOT NULL,
	"user_question" text NOT NULL,
	"ai_response" text NOT NULL,
	"ai_reasoning" text,
	"profile_label" varchar(255),
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"label" varchar(255) DEFAULT '' NOT NULL,
	"birth_date" varchar(20) DEFAULT '' NOT NULL,
	"birth_time" varchar(10) DEFAULT '' NOT NULL,
	"gender" varchar(10) DEFAULT '' NOT NULL,
	"birth_place" varchar(255) DEFAULT '' NOT NULL,
	"calendar_type" varchar(10) DEFAULT 'solar' NOT NULL,
	"is_leap_month" boolean DEFAULT false NOT NULL,
	"saved_charts" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;