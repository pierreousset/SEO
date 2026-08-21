CREATE TABLE IF NOT EXISTS "keyword_idea_snapshots" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "seeds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sources_used" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "fetched_at" timestamp NOT NULL DEFAULT now()
);
