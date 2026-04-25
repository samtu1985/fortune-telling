import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  username: varchar("username", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  authProvider: varchar("auth_provider", { length: 20 }).notNull().default("google"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  singleCredits: integer("single_credits").notNull().default(0),
  multiCredits: integer("multi_credits").notNull().default(0),
  singleUsed: integer("single_used").notNull().default(0),
  multiUsed: integer("multi_used").notNull().default(0),
  isAmbassador: boolean("is_ambassador").notNull().default(false),
  isFriend: boolean("is_friend").notNull().default(false),
  // Age verification + purchase gate
  birthDate: text("birth_date"),
  ageVerifiedAt: timestamp("age_verified_at", { withTimezone: true }),
  canPurchase: boolean("can_purchase").notNull().default(true),
});

export const usersRelations = relations(users, ({ many }) => ({
  profiles: many(profiles),
  conversations: many(conversations),
}));

// ─── Profiles ────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  birthTime: text("birth_time").notNull().default(""),
  gender: text("gender").notNull().default(""),
  birthPlace: text("birth_place").notNull().default(""),
  calendarType: varchar("calendar_type", { length: 10 }).notNull().default("solar"),
  isLeapMonth: boolean("is_leap_month").notNull().default(false),
  savedCharts: text("saved_charts"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

// ─── Conversations ───────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 10 }).notNull(), // bazi | ziwei | zodiac | multi
  userQuestion: text("user_question").notNull(),   // AES-256-GCM encrypted
  aiResponse: text("ai_response").notNull(),       // AES-256-GCM encrypted
  aiReasoning: text("ai_reasoning"),               // AES-256-GCM encrypted (nullable)
  profileLabel: varchar("profile_label", { length: 255 }),
  // "manual" = user clicked the save button. "auto" = system auto-saved
  // the last round to prevent data loss; rotated to keep only the 3 most
  // recent auto rows per (user, type).
  origin: varchar("origin", { length: 10 }).notNull().default("manual"),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
}));

// ─── AI Settings ─────────────────────────────────────────
export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  masterKey: varchar("master_key", { length: 30 }).unique().notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  apiUrl: text("api_url").notNull(),
  thinkingMode: varchar("thinking_mode", { length: 20 }),
  effort: varchar("effort", { length: 10 }),
  thinkingBudget: integer("thinking_budget"),
  reasoningDepth: varchar("reasoning_depth", { length: 10 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── API Usage ──────────────────────────────────────────
export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  masterType: varchar("master_type", { length: 20 }).notNull(),
  mode: varchar("mode", { length: 10 }).notNull(), // "single" | "multi"
  provider: varchar("provider", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Case Studies ───────────────────────────────────────
export const caseStudies = pgTable("case_studies", {
  id: uuid("id").primaryKey().defaultRandom(),
  summary: text("summary").notNull(),
  fullContent: text("full_content").notNull(),
  originalQuestion: text("original_question"),
  masterTypes: varchar("master_types", { length: 30 }).notNull().default("bazi,ziwei,zodiac"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Credit Settings ────────────────────────────────────
export const creditSettings = pgTable("credit_settings", {
  id: serial("id").primaryKey(),
  defaultSingleRounds: integer("default_single_rounds").notNull().default(10),
  defaultMultiSessions: integer("default_multi_sessions").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pending Credits ────────────────────────────────────
export const pendingCredits = pgTable("pending_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  singleCredits: integer("single_credits").notNull().default(0),
  multiCredits: integer("multi_credits").notNull().default(0),
  sentBy: varchar("sent_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Credit Grants Audit Log ────────────────────────────
// Write-once record of every credit gift sent via /api/credits/send.
// pending_credits rows get deleted on apply, so the audit trail of who
// sent what to whom would otherwise be lost. This table is append-only
// and survives everything, so admins can always trace credit grants.
export const creditGrants = pgTable("credit_grants", {
  id: serial("id").primaryKey(),
  senderEmail: varchar("sender_email", { length: 255 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  singleCredits: integer("single_credits").notNull().default(0),
  multiCredits: integer("multi_credits").notNull().default(0),
  // "direct": recipient existed at send time, credits added immediately.
  // "pending": recipient did not exist; stored in pending_credits, will
  //            be applied at their first verification/registration.
  deliveryMode: varchar("delivery_mode", { length: 10 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── TTS Settings ───────────────────────────────────────
export const ttsSettings = pgTable("tts_settings", {
  id: serial("id").primaryKey(),
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  modelId: varchar("model_id", { length: 50 }).notNull().default("eleven_v3"),
  stability: real("stability").notNull().default(0.7),
  similarityBoost: real("similarity_boost").notNull().default(0.75),
  style: real("style").notNull().default(0.0),
  speed: real("speed").notNull().default(1.0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── TTS Voices ─────────────────────────────────────────
export const ttsVoices = pgTable("tts_voices", {
  id: serial("id").primaryKey(),
  masterKey: varchar("master_key", { length: 30 }).notNull(),
  locale: varchar("locale", { length: 10 }).notNull(),
  voiceId: varchar("voice_id", { length: 100 }).notNull(),
});

// ─── TTS Pronunciation Rules ────────────────────────────
// Admin-editable text replacements applied to the TTS input BEFORE it's
// sent to ElevenLabs, so individual words that the model mispronounces
// can be rewritten without changing what the user sees on screen.
export const ttsPronunciationRules = pgTable("tts_pronunciation_rules", {
  id: serial("id").primaryKey(),
  pattern: text("pattern").notNull(),        // literal string to match (case-sensitive)
  replacement: text("replacement").notNull(),// literal string to substitute in
  note: text("note"),                        // optional admin memo
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── User Feedback ──────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  // User email if logged in, null for anonymous
  userEmail: varchar("user_email", { length: 255 }),
  message: text("message").notNull(),
  reply: text("reply"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  repliedBy: varchar("replied_by", { length: 255 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Payment Packages ───────────────────────────────────
export const paymentPackages = pgTable("payment_packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  buyButtonId: text("buy_button_id").notNull(),
  // Deprecated: publishable key is now read from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  // at render time. Column kept nullable for backward compat with existing rows.
  publishableKey: text("publishable_key"),
  stripePriceId: text("stripe_price_id"),
  priceAmount: integer("price_amount"),          // HKD cents
  currency: varchar("currency", { length: 10 }).notNull().default("hkd"),
  singleCreditsGranted: integer("single_credits_granted").notNull().default(0),
  multiCreditsGranted: integer("multi_credits_granted").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Purchases ──────────────────────────────────────────
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").references(() => paymentPackages.id),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(),           // HKD cents
  currency: varchar("currency", { length: 10 }).notNull(),
  singleGranted: integer("single_granted").notNull(),
  multiGranted: integer("multi_granted").notNull(),
  status: varchar("status", { length: 20 }).notNull(),  // paid | refunded | failed
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Stripe Events (webhook idempotency) ────────────────
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),                   // Stripe event id: evt_xxx
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Integration Settings (third-party services) ─────────
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 50 }).unique().notNull(),
  apiUrl: text("api_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Human Design API Cache ──────────────────────────────
export const humandesignCache = pgTable("humandesign_cache", {
  cacheKey: varchar("cache_key", { length: 64 }).primaryKey().notNull(),
  chartData: jsonb("chart_data"),
  imageBase64: text("image_base64"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
});
