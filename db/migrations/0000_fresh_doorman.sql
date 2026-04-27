CREATE TABLE "audit_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"check_key" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"detail" text,
	"fix" text,
	"ai_prioritized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site_id" text,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"pages_crawled" integer,
	"findings_count" integer,
	"high_severity_count" integer,
	"ai_summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "backlink_ref_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"backlinks" integer DEFAULT 0 NOT NULL,
	"dofollow_backlinks" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"first_seen" text,
	"last_seen" text,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backlink_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"total_backlinks" integer,
	"referring_domains" integer,
	"referring_pages" integer,
	"dofollow_backlinks" integer,
	"nofollow_backlinks" integer,
	"avg_ref_domain_rank" integer,
	"broken_backlinks" integer,
	"cost_usd" text,
	"competitor_summaries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "backlinks" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"target_url" text NOT NULL,
	"anchor" text,
	"dofollow" boolean DEFAULT false NOT NULL,
	"first_seen" text,
	"last_seen" text,
	"domain_rank" integer,
	"page_rank" integer,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brief_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"brief_id" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"summary" text NOT NULL,
	"top_movers" jsonb NOT NULL,
	"tickets" jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]' NOT NULL,
	"llm_model" text NOT NULL,
	"llm_cost_usd" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"business_name" text,
	"primary_service" text,
	"secondary_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_cities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_customer" text,
	"average_customer_value_eur" integer,
	"competitor_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"biggest_seo_problem" text,
	"preferred_language" text DEFAULT 'fr' NOT NULL,
	"weekly_email_enabled" boolean DEFAULT true NOT NULL,
	"weekly_email_recipient" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cannibalization_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"days_window" integer DEFAULT 28 NOT NULL,
	"queries_scanned" integer,
	"findings_count" integer,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_gap_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"competitors_scanned" integer,
	"keywords_inspected" integer,
	"gaps_found" integer,
	"cost_usd" text,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "competitor_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"competitor_domain" text NOT NULL,
	"date" text NOT NULL,
	"position" integer,
	"url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"content" jsonb,
	"llm_model" text,
	"cost_usd" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stripe_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits_wallet" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_purchased" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fetch_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"task_count" integer,
	"result_count" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "gsc_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"date" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" text DEFAULT '0' NOT NULL,
	"gsc_position" text DEFAULT '0' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_page_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"date" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" text DEFAULT '0' NOT NULL,
	"position" text DEFAULT '0' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"days_requested" integer,
	"rows_fetched" integer,
	"metrics_upserted" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "gsc_site_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" text DEFAULT '0' NOT NULL,
	"position" text DEFAULT '0' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"scope" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site_id" text NOT NULL,
	"query" text NOT NULL,
	"country" text DEFAULT 'fr' NOT NULL,
	"device" text DEFAULT 'desktop' NOT NULL,
	"intent_stage" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "llm_visibility_results" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"engine" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"mentioned" boolean DEFAULT false NOT NULL,
	"position" integer,
	"cited_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitor_mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer_snippet" text,
	"cost_usd" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "llm_visibility_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"engines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"keyword_count" integer,
	"check_count" integer,
	"mentioned_count" integer,
	"cost_usd" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "meta_crawl_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"title_length" integer,
	"meta_description" text,
	"meta_description_length" integer,
	"h1" text,
	"canonical" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"word_count" integer,
	"http_status" integer,
	"response_ms" integer,
	"indexable" boolean DEFAULT true NOT NULL,
	"in_sitemap" boolean DEFAULT false NOT NULL,
	"internal_links_out" integer,
	"linked_from" text
);
--> statement-breakpoint
CREATE TABLE "meta_crawl_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site_id" text,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"pages_crawled" integer,
	"sitemap_urls" integer,
	"orphan_pages" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"date" text NOT NULL,
	"position" integer,
	"url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"gsc_property_uri" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_customers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_status" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"brief_id" text NOT NULL,
	"ticket_index" integer NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_run_id_audit_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."audit_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlink_ref_domains" ADD CONSTRAINT "backlink_ref_domains_run_id_backlink_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backlink_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlink_ref_domains" ADD CONSTRAINT "backlink_ref_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlink_runs" ADD CONSTRAINT "backlink_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlinks" ADD CONSTRAINT "backlinks_run_id_backlink_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backlink_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backlinks" ADD CONSTRAINT "backlinks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_runs" ADD CONSTRAINT "brief_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cannibalization_runs" ADD CONSTRAINT "cannibalization_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_gap_runs" ADD CONSTRAINT "competitor_gap_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_positions" ADD CONSTRAINT "competitor_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_positions" ADD CONSTRAINT "competitor_positions_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits_wallet" ADD CONSTRAINT "credits_wallet_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_runs" ADD CONSTRAINT "fetch_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_metrics" ADD CONSTRAINT "gsc_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_metrics" ADD CONSTRAINT "gsc_metrics_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_page_metrics" ADD CONSTRAINT "gsc_page_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_runs" ADD CONSTRAINT "gsc_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_site_metrics" ADD CONSTRAINT "gsc_site_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_tokens" ADD CONSTRAINT "gsc_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_visibility_results" ADD CONSTRAINT "llm_visibility_results_run_id_llm_visibility_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."llm_visibility_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_visibility_results" ADD CONSTRAINT "llm_visibility_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_visibility_results" ADD CONSTRAINT "llm_visibility_results_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_visibility_runs" ADD CONSTRAINT "llm_visibility_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_crawl_pages" ADD CONSTRAINT "meta_crawl_pages_run_id_meta_crawl_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."meta_crawl_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_crawl_pages" ADD CONSTRAINT "meta_crawl_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_crawl_runs" ADD CONSTRAINT "meta_crawl_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_crawl_runs" ADD CONSTRAINT "meta_crawl_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_status" ADD CONSTRAINT "ticket_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_status" ADD CONSTRAINT "ticket_status_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_findings_run_idx" ON "audit_findings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_findings_severity_idx" ON "audit_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "audit_runs_user_idx" ON "audit_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "backlink_ref_run_idx" ON "backlink_ref_domains" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "backlink_ref_user_idx" ON "backlink_ref_domains" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "backlink_ref_unique" ON "backlink_ref_domains" USING btree ("run_id","domain");--> statement-breakpoint
CREATE INDEX "backlink_runs_user_idx" ON "backlink_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "backlink_runs_queued_idx" ON "backlink_runs" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX "backlinks_run_idx" ON "backlinks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "backlinks_user_idx" ON "backlinks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "backlinks_rank_idx" ON "backlinks" USING btree ("domain_rank");--> statement-breakpoint
CREATE INDEX "brief_runs_user_idx" ON "brief_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brief_runs_status_idx" ON "brief_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_user_period" ON "briefs" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "cannibal_runs_user_idx" ON "cannibalization_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_updated_idx" ON "chat_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "chat_messages_conv_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_user_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competitor_gap_runs_user_idx" ON "competitor_gap_runs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_positions_unique" ON "competitor_positions" USING btree ("keyword_id","competitor_domain","date");--> statement-breakpoint
CREATE INDEX "competitor_positions_user_idx" ON "competitor_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_briefs_user_idx" ON "content_briefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_briefs_keyword_idx" ON "content_briefs" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "content_briefs_queued_idx" ON "content_briefs" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX "credit_tx_user_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_tx_event_idx" ON "credit_transactions" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "fetch_runs_user_idx" ON "fetch_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fetch_runs_status_idx" ON "fetch_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_metrics_unique" ON "gsc_metrics" USING btree ("keyword_id","date");--> statement-breakpoint
CREATE INDEX "gsc_metrics_user_idx" ON "gsc_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gsc_metrics_date_idx" ON "gsc_metrics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_page_metrics_unique" ON "gsc_page_metrics" USING btree ("user_id","url","date");--> statement-breakpoint
CREATE INDEX "gsc_page_metrics_url_idx" ON "gsc_page_metrics" USING btree ("url");--> statement-breakpoint
CREATE INDEX "gsc_page_metrics_date_idx" ON "gsc_page_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "gsc_runs_user_idx" ON "gsc_runs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_site_metrics_unique" ON "gsc_site_metrics" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "gsc_site_metrics_date_idx" ON "gsc_site_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "keywords_user_idx" ON "keywords" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "keywords_site_idx" ON "keywords" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_unique" ON "keywords" USING btree ("site_id","query","country","device");--> statement-breakpoint
CREATE INDEX "llm_vis_results_run_idx" ON "llm_visibility_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "llm_vis_results_keyword_idx" ON "llm_visibility_results" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "llm_vis_results_user_idx" ON "llm_visibility_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_vis_runs_user_idx" ON "llm_visibility_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meta_crawl_pages_run_idx" ON "meta_crawl_pages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "meta_crawl_pages_user_idx" ON "meta_crawl_pages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meta_crawl_runs_user_idx" ON "meta_crawl_runs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_keyword_date" ON "positions" USING btree ("keyword_id","date");--> statement-breakpoint
CREATE INDEX "positions_user_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sites_user_idx" ON "sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subs_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subs_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_status_unique" ON "ticket_status" USING btree ("brief_id","ticket_index");--> statement-breakpoint
CREATE INDEX "ticket_status_user_idx" ON "ticket_status" USING btree ("user_id");