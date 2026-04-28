import { pgTable, text, timestamp, integer, boolean, jsonb, uniqueIndex, index, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Better Auth core tables

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  onboardingEmailSent: boolean("onboarding_email_sent").notNull().default(false),
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

// -------------------------------------------------------------------
// Team / invite tables — allows an owner to invite other users to
// share their account data. Members see the owner's data, billing
// stays owner-only.
// -------------------------------------------------------------------
export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'member' for now
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("team_members_unique").on(t.ownerId, t.userId),
  index("team_members_user_idx").on(t.userId),
  index("team_members_owner_idx").on(t.ownerId),
]);

export const teamInvites = pgTable("team_invites", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("team_invites_owner_idx").on(t.ownerId),
  index("team_invites_token_idx").on(t.token),
]);

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
  // Weekly brief email delivery. Default on — opt out via the form.
  // If recipient is null, sends to the user's login email.
  weeklyEmailEnabled: boolean("weekly_email_enabled").notNull().default(true),
  weeklyEmailRecipient: text("weekly_email_recipient"),
  // Email digest customization
  emailDigestFrequency: text("email_digest_frequency").notNull().default("weekly"), // 'daily' | 'weekly' | 'monthly' | 'off'
  emailDigestSections: jsonb("email_digest_sections").$type<string[]>().notNull().default(["health_score", "top_issues", "position_changes", "brief_summary"]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ----- Billing: Stripe customers, subscriptions, credits wallet -----
export const stripeCustomers = pgTable("stripe_customers", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Mirrors the bits we need from Stripe to gate features. Webhooks are source of truth.
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(), // stripe subscription id
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  plan: text("plan").notNull(), // 'pro' | future tiers
  status: text("status").notNull(), // 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("subs_user_idx").on(t.userId),
  index("subs_status_idx").on(t.status),
]);

// One row per user, debited as user spends credits on metered actions.
export const creditsWallet = pgTable("credits_wallet", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Append-only ledger of every credit movement. Source of truth for any balance audit.
export const creditTransactions = pgTable("credit_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive = credit, negative = debit
  reason: text("reason").notNull(), // 'purchase' | 'audit' | 'competitor_discovery' | 'ai_suggestions' | 'extra_site' | 'refund' | 'bonus'
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  stripeEventId: text("stripe_event_id"), // for purchase rows — idempotency
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("credit_tx_user_idx").on(t.userId),
  index("credit_tx_event_idx").on(t.stripeEventId),
]);

// User-provided API keys — encrypted at rest with AES-256-GCM (lib/encryption.ts).
// When present, these override the platform-level env vars for AI features.
export const userApiKeys = pgTable("user_api_keys", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  anthropicKey: text("anthropic_key"),       // encrypted
  googleGeminiKey: text("google_gemini_key"), // encrypted
  huggingfaceKey: text("huggingface_key"),   // encrypted
  nvidiaKey: text("nvidia_key"),             // encrypted
  ollamaKey: text("ollama_key"),              // encrypted — cloud Ollama API key
  ollamaUrl: text("ollama_url"),             // e.g. https://api.ollama.com or http://localhost:11434
  ollamaModel: text("ollama_model"),         // e.g. llama3, mistral
  lmStudioUrl: text("lm_studio_url"),        // e.g. http://localhost:1234
  lmStudioModel: text("lm_studio_model"),    // e.g. local-model
  byokEnabled: boolean("byok_enabled").notNull().default(false),
  // Auto-refill notification settings
  autoRefillEnabled: boolean("auto_refill_enabled").notNull().default(false),
  autoRefillThreshold: integer("auto_refill_threshold").notNull().default(10),
  autoRefillPackPriceId: text("auto_refill_pack_price_id"),
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

// GSC daily TOTALS for the site (all queries, all pages). Used for the GSC-style
// performance chart "All site" view. Separate from gscMetrics which is per-keyword.
export const gscSiteMetrics = pgTable("gsc_site_metrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: text("ctr").notNull().default("0"),
  position: text("position").notNull().default("0"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("gsc_site_metrics_unique").on(t.userId, t.date),
  index("gsc_site_metrics_date_idx").on(t.date),
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

// Site audit runs — track each on-page audit attempt.
export const auditRuns = pgTable("audit_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
  source: text("source").notNull(), // 'manual'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  pagesCrawled: integer("pages_crawled"),
  findingsCount: integer("findings_count"),
  highSeverityCount: integer("high_severity_count"),
  aiSummary: text("ai_summary"),
  error: text("error"),
}, (t) => [
  index("audit_runs_user_idx").on(t.userId),
]);

// One finding per (audit run × page × check). Dimensions:
//   severity: high | medium | low | info
//   category: title | meta | h1 | canonical | og | schema | alt | links | content | tech | site
export const auditFindings = pgTable("audit_findings", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  category: text("category").notNull(),
  checkKey: text("check_key").notNull(),
  severity: text("severity").notNull(), // high | medium | low | info
  message: text("message").notNull(),
  detail: text("detail"),
  fix: text("fix"), // human-readable fix instruction, may be enriched by AI
  aiPrioritized: boolean("ai_prioritized").notNull().default(false),
}, (t) => [
  index("audit_findings_run_idx").on(t.runId),
  index("audit_findings_severity_idx").on(t.severity),
]);

// -------------------------------------------------------------------
// Full-site meta crawl — separate from the 10-page audit.
// Parses the sitemap, crawls every page, extracts metas + internal
// links, then compares found URLs vs sitemap for coverage gaps.
// -------------------------------------------------------------------
export const metaCrawlRuns = pgTable("meta_crawl_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
  status: text("status").notNull(), // queued | running | done | failed
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  pagesCrawled: integer("pages_crawled"),
  sitemapUrls: integer("sitemap_urls"), // how many URLs found in sitemap
  orphanPages: integer("orphan_pages"), // pages found via links but not in sitemap
  error: text("error"),
}, (t) => [
  index("meta_crawl_runs_user_idx").on(t.userId),
]);

export const metaCrawlPages = pgTable("meta_crawl_pages", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => metaCrawlRuns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  titleLength: integer("title_length"),
  metaDescription: text("meta_description"),
  metaDescriptionLength: integer("meta_description_length"),
  h1: text("h1"),
  canonical: text("canonical"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  wordCount: integer("word_count"),
  httpStatus: integer("http_status"),
  responseMs: integer("response_ms"),
  indexable: boolean("indexable").notNull().default(true),
  inSitemap: boolean("in_sitemap").notNull().default(false),
  internalLinksOut: integer("internal_links_out"), // how many internal links on this page
  linkedFrom: text("linked_from"), // JSON array of URLs that link to this page
}, (t) => [
  index("meta_crawl_pages_run_idx").on(t.runId),
  index("meta_crawl_pages_user_idx").on(t.userId),
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

// Backlink pulls — one run per scan. Stores aggregate summary inline; the
// top backlinks + referring domains live in separate tables so we can diff
// across runs (detect new / lost links) without JSONB acrobatics.
export const backlinkRuns = pgTable("backlink_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'manual'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  // Aggregate summary from /backlinks/summary
  totalBacklinks: integer("total_backlinks"),
  referringDomains: integer("referring_domains"),
  referringPages: integer("referring_pages"),
  dofollowBacklinks: integer("dofollow_backlinks"),
  nofollowBacklinks: integer("nofollow_backlinks"),
  avgRefDomainRank: integer("avg_ref_domain_rank"),
  brokenBacklinks: integer("broken_backlinks"),
  costUsd: text("cost_usd"),
  // Per-competitor profiles pulled in the same run. Stored inline so
  // the UI can render a side-by-side comparison without extra tables.
  competitorSummaries: jsonb("competitor_summaries").$type<Array<{
    domain: string;
    totalBacklinks: number;
    referringDomains: number;
    dofollowBacklinks: number;
    avgRefDomainRank: number | null;
    topRefDomains: Array<{ domain: string; rank: number | null; backlinks: number }>;
    error?: string;
  }>>().notNull().default([]),
  error: text("error"),
}, (t) => [
  index("backlink_runs_user_idx").on(t.userId),
  index("backlink_runs_queued_idx").on(t.queuedAt),
]);

// One row per backlink captured by a run. We keep them per-run (not upserted)
// so the UI can diff "backlinks in the latest run vs previous run" → new/lost.
export const backlinks = pgTable("backlinks", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => backlinkRuns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  targetUrl: text("target_url").notNull(),
  anchor: text("anchor"),
  dofollow: boolean("dofollow").notNull().default(false),
  firstSeen: text("first_seen"),
  lastSeen: text("last_seen"),
  domainRank: integer("domain_rank"),
  pageRank: integer("page_rank"),
  isNew: boolean("is_new").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
}, (t) => [
  index("backlinks_run_idx").on(t.runId),
  index("backlinks_user_idx").on(t.userId),
  index("backlinks_rank_idx").on(t.domainRank),
]);

// Aggregated per referring domain, one row per (run × ref domain).
export const backlinkRefDomains = pgTable("backlink_ref_domains", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => backlinkRuns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  backlinks: integer("backlinks").notNull().default(0),
  dofollowBacklinks: integer("dofollow_backlinks").notNull().default(0),
  rank: integer("rank"),
  firstSeen: text("first_seen"),
  lastSeen: text("last_seen"),
  isNew: boolean("is_new").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
}, (t) => [
  index("backlink_ref_run_idx").on(t.runId),
  index("backlink_ref_user_idx").on(t.userId),
  uniqueIndex("backlink_ref_unique").on(t.runId, t.domain),
]);

// Chat conversations — threads of Q&A with Claude over user's SEO data.
export const chatConversations = pgTable("chat_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("chat_conversations_user_idx").on(t.userId),
  index("chat_conversations_updated_idx").on(t.updatedAt),
]);

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(), // user prompt OR assistant final text
  // Trace of tool calls made during this assistant turn. Useful for debugging
  // + showing "I searched keywords → read positions → ..." in the UI.
  toolCalls: jsonb("tool_calls").$type<Array<{
    name: string;
    input: Record<string, unknown>;
    output: unknown;
  }>>().notNull().default([]),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: text("cost_usd"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("chat_messages_conv_idx").on(t.conversationId),
  index("chat_messages_user_idx").on(t.userId),
]);

// Competitor keyword gap scans — pull ranked keywords for each declared
// competitor, diff against the user's tracked queries + GSC queries, surface
// the gap. Findings stored inline on the run row.
export const competitorGapRuns = pgTable("competitor_gap_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'manual'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  competitorsScanned: integer("competitors_scanned"),
  keywordsInspected: integer("keywords_inspected"),
  gapsFound: integer("gaps_found"),
  costUsd: text("cost_usd"),
  findings: jsonb("findings").$type<Array<{
    keyword: string;
    competitorDomain: string;
    competitorPosition: number;
    competitorUrl: string | null;
    searchVolume: number | null;
    cpc: number | null;
    keywordDifficulty: number | null;
    intentStage: number | null; // from classifyIntentRule
    alsoOn: string[]; // other competitor domains that also rank for this query
  }>>().notNull().default([]),
  error: text("error"),
}, (t) => [
  index("competitor_gap_runs_user_idx").on(t.userId),
]);

// GSC page-level metrics — one row per (user, url, date). Pulled with
// dimensions=[page, date] so we have per-page click / impression trends
// AND can list "indexed pages" (any URL with >= 1 impression in the window).
export const gscPageMetrics = pgTable("gsc_page_metrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: text("ctr").notNull().default("0"),
  position: text("position").notNull().default("0"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("gsc_page_metrics_unique").on(t.userId, t.url, t.date),
  index("gsc_page_metrics_url_idx").on(t.url),
  index("gsc_page_metrics_date_idx").on(t.date),
]);

// Content briefs — one row per (keyword, generation). Keep history by not
// deleting on regenerate. Latest = ORDER BY queuedAt DESC LIMIT 1.
export const contentBriefs = pgTable("content_briefs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // queued | running | done | failed
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  // Nullable until status=done. Shape is enforced by lib/llm/content-brief.ts schema.
  content: jsonb("content").$type<{
    targetIntent: string;
    primaryAngle: string;
    wordCountMin: number;
    wordCountMax: number;
    outline: Array<{ h2: string; h3s: string[]; notes: string }>;
    entitiesToCover: string[];
    questionsToAnswer: string[];
    metaTitleVariants: string[];
    metaDescription: string;
    competitorInsights: Array<{
      url: string;
      domain: string;
      position: number;
      strength: "weak" | "medium" | "strong";
      takeaway: string;
    }>;
    internalLinkingHints: string[];
    warnings: string[];
  }>(),
  llmModel: text("llm_model"),
  costUsd: text("cost_usd"),
  error: text("error"),
}, (t) => [
  index("content_briefs_user_idx").on(t.userId),
  index("content_briefs_keyword_idx").on(t.keywordId),
  index("content_briefs_queued_idx").on(t.queuedAt),
]);

// Cannibalization scans — one per run. Stores findings inline (no separate
// details table): each run is self-contained and cheap to re-run.
// A "finding" is a query where >= 2 of your URLs have meaningful impressions.
export const cannibalizationRuns = pgTable("cannibalization_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'manual'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  daysWindow: integer("days_window").notNull().default(28),
  queriesScanned: integer("queries_scanned"),
  findingsCount: integer("findings_count"),
  findings: jsonb("findings").$type<Array<{
    query: string;
    trackedKeywordId: string | null;
    severity: "high" | "medium" | "low";
    totalImpressions: number;
    totalClicks: number;
    urls: Array<{
      page: string;
      clicks: number;
      impressions: number;
      position: number;
      share: number; // fraction of query impressions on this URL
    }>;
  }>>().notNull().default([]),
  error: text("error"),
}, (t) => [
  index("cannibal_runs_user_idx").on(t.userId),
]);

// LLM visibility (AEO) — tracks whether your domain is cited in LLM answers.
// Each run checks a batch of keywords against one or more engines.
export const llmVisibilityRuns = pgTable("llm_visibility_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'manual' | 'cron'
  status: text("status").notNull(), // queued | running | done | failed | skipped
  engines: jsonb("engines").$type<string[]>().notNull().default([]), // ['perplexity','claude','openai']
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  keywordCount: integer("keyword_count"),
  checkCount: integer("check_count"), // keywordCount × engines.length
  mentionedCount: integer("mentioned_count"),
  costUsd: text("cost_usd"),
  error: text("error"),
}, (t) => [
  index("llm_vis_runs_user_idx").on(t.userId),
]);

// One row per (keyword × engine × run). Lets us trend over time.
export const llmVisibilityResults = pgTable("llm_visibility_results", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => llmVisibilityRuns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  engine: text("engine").notNull(), // 'perplexity' | 'claude' | 'openai'
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
  mentioned: boolean("mentioned").notNull().default(false),
  position: integer("position"), // rank of user's domain in the cited list, null if not cited
  citedUrls: jsonb("cited_urls").$type<Array<{ url: string; title?: string; domain: string }>>().notNull().default([]),
  competitorMentions: jsonb("competitor_mentions").$type<Array<{ domain: string; position: number }>>().notNull().default([]),
  answerSnippet: text("answer_snippet"), // first ~500 chars of the LLM answer
  costUsd: text("cost_usd"),
  error: text("error"),
}, (t) => [
  index("llm_vis_results_run_idx").on(t.runId),
  index("llm_vis_results_keyword_idx").on(t.keywordId),
  index("llm_vis_results_user_idx").on(t.userId),
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

// Generated articles — full SEO-optimized articles produced by AI.
export const generatedArticles = pgTable("generated_articles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").references(() => keywords.id, { onDelete: "set null" }),
  title: text("title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  slug: text("slug").notNull().default(""),
  content: text("content").notNull().default(""),
  wordCount: integer("word_count"),
  status: text("status").notNull(), // queued | generating | done | failed
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("generated_articles_user_idx").on(t.userId),
  index("generated_articles_keyword_idx").on(t.keywordId),
  index("generated_articles_status_idx").on(t.status),
]);

// Keyword groups — user-defined tags/folders for organizing keywords.
export const keywordGroups = pgTable("keyword_groups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // hex color, e.g. "#A855F7"
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("keyword_groups_user_idx").on(t.userId),
]);

// Many-to-many: which keywords belong to which groups.
export const keywordGroupMembers = pgTable("keyword_group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => keywordGroups.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("keyword_group_members_unique").on(t.groupId, t.keywordId),
  index("keyword_group_members_keyword_idx").on(t.keywordId),
]);

// Public share links — shareable read-only URLs for briefs and audits.
export const shareLinks = pgTable("share_links", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // 'brief' | 'audit'
  resourceId: text("resource_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("share_links_user_idx").on(t.userId),
  index("share_links_token_idx").on(t.token),
]);

// Position alerts — user-configured alerts on keyword rank changes.
export const positionAlerts = pgTable("position_alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  condition: text("condition").notNull(), // 'exits_top_3' | 'exits_top_10' | 'exits_top_20' | 'drops_by_5' | 'drops_by_10'
  enabled: boolean("enabled").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("position_alerts_user_idx").on(t.userId),
  index("position_alerts_keyword_idx").on(t.keywordId),
]);

// Audit log — tracks every meaningful user action for accountability.
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_user_idx").on(t.userId),
  index("audit_log_actor_idx").on(t.actorId),
  index("audit_log_created_idx").on(t.createdAt),
]);

// SEO health scores — recomputed after every daily fetch.
export const seoScores = pgTable("seo_scores", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
  score: integer("score").notNull(), // 0-100
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull(),
  issues: jsonb("issues").$type<Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    impact: string;
    whyItMatters?: string;
    affectedPages?: string[];
    affectedKeywords?: string[];
  }>>().notNull(),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
}, (t) => [
  index("seo_scores_user_idx").on(t.userId),
]);

// SERP features detected per keyword per day. Tracks which SERP features
// appear for a keyword and whether the user's page shows in any of them.
export const serpFeatures = pgTable("serp_features", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  features: jsonb("features").$type<string[]>().notNull().default([]), // array of feature names detected
  hasFeature: boolean("has_feature").notNull().default(false), // does user's page appear in a feature
  featureType: text("feature_type"), // which feature the user appears in, if any
}, (t) => [
  uniqueIndex("serp_features_unique").on(t.keywordId, t.date),
  index("serp_features_user_idx").on(t.userId),
  index("serp_features_keyword_idx").on(t.keywordId),
]);

// Core Web Vitals — PageSpeed Insights results per URL.
export const webVitals = pgTable("web_vitals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  performanceScore: integer("performance_score"),
  lcp: integer("lcp"), // Largest Contentful Paint (ms)
  fcp: integer("fcp"), // First Contentful Paint (ms)
  cls: real("cls"), // Cumulative Layout Shift
  ttfb: integer("ttfb"), // Time to First Byte (ms)
  fetchedAt: timestamp("fetched_at").notNull(),
}, (t) => [
  index("web_vitals_user_idx").on(t.userId),
  index("web_vitals_fetched_idx").on(t.fetchedAt),
]);

// Referral program — tracks who referred whom and credit rewards.
export const referrals = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredEmail: text("referred_email").notNull(),
  referredUserId: text("referred_user_id").references(() => users.id, { onDelete: "set null" }),
  creditsAwarded: boolean("credits_awarded").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("referrals_referrer_idx").on(t.referrerId),
  index("referrals_referred_user_idx").on(t.referredUserId),
  uniqueIndex("referrals_email_unique").on(t.referredEmail),
]);

// Webhook subscriptions — fire notifications to Slack / Discord / custom URL.
export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  provider: text("provider").notNull(), // 'slack' | 'discord' | 'custom'
  events: jsonb("events").$type<string[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("webhooks_user_idx").on(t.userId),
]);

// Public REST API keys — hashed, shown once at creation.
export const apiTokens = pgTable("api_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("api_tokens_user_idx").on(t.userId),
  index("api_tokens_hash_idx").on(t.keyHash),
]);

// Relations (for Drizzle query helpers)
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  sites: many(sites),
  keywords: many(keywords),
  briefs: many(briefs),
  gscToken: one(gscTokens),
}));
