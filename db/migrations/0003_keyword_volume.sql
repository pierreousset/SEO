ALTER TABLE "keywords"
  ADD COLUMN IF NOT EXISTS "search_volume" integer,
  ADD COLUMN IF NOT EXISTS "keyword_difficulty" integer,
  ADD COLUMN IF NOT EXISTS "cpc" real,
  ADD COLUMN IF NOT EXISTS "search_intent" text,
  ADD COLUMN IF NOT EXISTS "volume_updated_at" timestamp;
