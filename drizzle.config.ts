import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local first (Next.js convention), then fall back to .env.
config({ path: ".env.local" });
config({ path: ".env" });

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
