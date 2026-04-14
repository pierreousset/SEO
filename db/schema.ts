import { pgTable, text, timestamp, integer, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Better Auth core tables

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Domain tables

export const sites = pgTable("sites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  gscPropertyUri: text("gsc_property_uri"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("sites_user_idx").on(t.userId),
]);

// Business context — passed as system prompt to the AI brief generator so
// recommendations are sharp and specific instead of generic SEO advice.
// One row per user, upserted from /dashboard/business.
export const businessProfiles = pgTable("business_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  primaryService: text("primary_service"),
  secondaryServices: jsonb("secondary_services").$type<string[]>().notNull().default([]),
  targetCities: jsonb("target_cities").$type<string[]>().notNull().default([]),
  targetCustomer: text("target_customer"),
  averageCustomerValueEur: integer("average_customer_value_eur"),
  competitorUrls: jsonb("competitor_urls").$type<string[]>().notNull().default([]),
  biggestSeoProblem: text("biggest_seo_problem"),
  preferredLanguage: text("preferred_language").notNull().default("fr"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Encrypted GSC OAuth tokens — one per user.
// Note: refresh_token is encrypted at rest with AES-256-GCM via lib/encryption.ts.
export const gscTokens = pgTable("gsc_tokens", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  scope: text("scope").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastRefreshedAt: timestamp("last_refreshed_at"),
});

export const keywords = pgTable("keywords", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  country: text("country").notNull().default("fr"),
  device: text("device").notNull().default("desktop"),
  // Intent stage 1-4 (problem-unaware → ready-to-hire). Null = not yet classified.
  // 1=problem-unaware, 2=problem-aware, 3=solution-aware, 4=ready-to-hire
  intentStage: integer("intent_stage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  removedAt: timestamp("removed_at"),
}, (t) => [
  index("keywords_user_idx").on(t.userId),
  index("keywords_site_idx").on(t.siteId),
  uniqueIndex("keywords_unique").on(t.siteId, t.query, t.country, t.device),
]);

// Daily position history. One row per (keyword, date).
export const positions = pgTable("positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD, UTC
  position: integer("position"), // null = not in top 100
  url: text("url"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("positions_keyword_date").on(t.keywordId, t.date),
  index("positions_user_idx").on(t.userId),
]);

// Competitor positions — same SERP scan as `positions`, just for declared competitor domains.
// Free data: DataForSEO returns the full SERP, we already pay for the call. Just extract more.
export const competitorPositions = pgTable("competitor_positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  competitorDomain: text("competitor_domain").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD UTC
  position: integer("position"), // null = not in top N
  url: text("url"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("competitor_positions_unique").on(t.keywordId, t.competitorDomain, t.date),
  index("competitor_positions_user_idx").on(t.userId),
]);

// GSC daily metrics per keyword. Pulled from Google Search Console searchanalytics
// with dimensions=[query, date]. Gives us 90+ days of historical data — clicks,
// impressions, CTR, average position — that DataForSEO SERP fetches don't cover.
//
// This is what unlocks accurate ROI estimates ("+60 clicks/month if you go from #11 to #5")
// and CTR-based diagnostics (weak_ctr, low_authority).
export const gscMetrics = pgTable("gsc_metrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD UTC
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: text("ctr").notNull().default("0"), // stored as text, parsed to float (0-1) for math
  gscPosition: text("gsc_position").notNull().default("0"), // text for fractional positions like 11.4
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("gsc_metrics_unique").on(t.keywordId, t.date),
  index("gsc_metrics_user_idx").on(t.userId),
  index("gsc_metrics_date_idx").on(t.date),
]);

// AI briefs — one per (user, period).
export const briefs = pgTable("briefs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(),
  summary: text("summary").notNull(),
  topMovers: jsonb("top_movers").notNull(), // [{ keyword, delta, probable_cause, confidence }]
  tickets: jsonb("tickets").notNull(), // [{ priority, action, target, why, estimated_effort_min, done? }]
  warnings: jsonb("warnings").notNull().default("[]"),
  llmModel: text("llm_model").notNull(),
  llmCostUsd: text("llm_cost_usd"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("briefs_user_period").on(t.userId, t.periodStart),
]);

// Fetch runs — every SERP fetch attempt (cron or manual). Status moves:
//   queued → running → done / failed / skipped
export const fetchRuns = pgTable("fetch_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'cron' | 'manual'
  status: text("status").notNull(), // 'queued' | 'running' | 'done' | 'failed' | 'skipped'
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  taskCount: integer("task_count"), // SERPs requested
  resultCount: integer("result_count"), // SERPs that returned a position
  error: text("error"),
}, (t) => [
  index("fetch_runs_user_idx").on(t.userId),
  index("fetch_runs_status_idx").on(t.status),
]);

// GSC history pull runs — track each manual or scheduled GSC sync attempt.
export const gscRuns = pgTable("gsc_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'cron' | 'manual'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  daysRequested: integer("days_requested"),
  rowsFetched: integer("rows_fetched"),
  metricsUpserted: integer("metrics_upserted"),
  error: text("error"),
}, (t) => [
  index("gsc_runs_user_idx").on(t.userId),
]);

// Brief generation runs — same model as fetchRuns but tracking AI brief jobs.
//   queued → running → done / failed / skipped
export const briefRuns = pgTable("brief_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'cron' | 'manual'
  status: text("status").notNull(), // 'queued' | 'running' | 'done' | 'failed' | 'skipped'
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  briefId: text("brief_id"), // FK to briefs.id once produced (no cascade — keep run history)
  error: text("error"),
}, (t) => [
  index("brief_runs_user_idx").on(t.userId),
  index("brief_runs_status_idx").on(t.status),
]);

// Ticket state — cochable actions from briefs.
export const ticketStatus = pgTable("ticket_status", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  briefId: text("brief_id").notNull().references(() => briefs.id, { onDelete: "cascade" }),
  ticketIndex: integer("ticket_index").notNull(),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at"),
}, (t) => [
  uniqueIndex("ticket_status_unique").on(t.briefId, t.ticketIndex),
  index("ticket_status_user_idx").on(t.userId),
]);

// Relations (for Drizzle query helpers)
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  sites: many(sites),
  keywords: many(keywords),
  briefs: many(briefs),
  gscToken: one(gscTokens),
}));
