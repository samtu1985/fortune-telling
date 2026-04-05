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
  birthDate: varchar("birth_date", { length: 20 }).notNull().default(""),
  birthTime: varchar("birth_time", { length: 10 }).notNull().default(""),
  gender: varchar("gender", { length: 10 }).notNull().default(""),
  birthPlace: varchar("birth_place", { length: 255 }).notNull().default(""),
  calendarType: varchar("calendar_type", { length: 10 }).notNull().default("solar"),
  isLeapMonth: boolean("is_leap_month").notNull().default(false),
  savedCharts: jsonb("saved_charts").$type<{ bazi?: string; ziwei?: string; zodiac?: string }>(),
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
  type: varchar("type", { length: 10 }).notNull(),
  userQuestion: text("user_question").notNull(),
  aiResponse: text("ai_response").notNull(),
  aiReasoning: text("ai_reasoning"),
  profileLabel: varchar("profile_label", { length: 255 }),
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
