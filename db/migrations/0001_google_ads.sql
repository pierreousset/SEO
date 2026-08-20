CREATE TABLE IF NOT EXISTS "ads_tokens" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "encrypted_refresh_token" text NOT NULL,
  "scope" text NOT NULL,
  "connected_at" timestamp NOT NULL DEFAULT now(),
  "last_refreshed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "ads_accounts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL,
  "descriptive_name" text,
  "currency_code" text,
  "manager" boolean NOT NULL DEFAULT false,
  "selected" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ads_accounts_unique" ON "ads_accounts" ("user_id", "customer_id");
CREATE INDEX IF NOT EXISTS "ads_accounts_user_idx" ON "ads_accounts" ("user_id");

CREATE TABLE IF NOT EXISTS "ads_search_terms" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL,
  "query" text NOT NULL,
  "clicks" integer NOT NULL DEFAULT 0,
  "impressions" integer NOT NULL DEFAULT 0,
  "cost_micros" bigint NOT NULL DEFAULT 0,
  "conversions" real NOT NULL DEFAULT 0,
  "period_start" text NOT NULL,
  "period_end" text NOT NULL,
  "fetched_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ads_search_terms_unique" ON "ads_search_terms" ("user_id", "customer_id", "query", "period_start");
CREATE INDEX IF NOT EXISTS "ads_search_terms_user_idx" ON "ads_search_terms" ("user_id");

CREATE TABLE IF NOT EXISTS "ads_runs" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "status" text NOT NULL,
  "queued_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "finished_at" timestamp,
  "rows_fetched" integer,
  "error" text
);
CREATE INDEX IF NOT EXISTS "ads_runs_user_idx" ON "ads_runs" ("user_id");
