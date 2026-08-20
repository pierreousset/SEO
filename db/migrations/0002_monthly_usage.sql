CREATE TABLE IF NOT EXISTS "monthly_usage" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "period" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "action", "period")
);
CREATE INDEX IF NOT EXISTS "monthly_usage_user_idx" ON "monthly_usage" ("user_id");
