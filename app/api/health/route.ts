import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, ms: Date.now() - dbStart };
  } catch (e: any) {
    checks.database = { ok: false, ms: Date.now() - dbStart, error: e?.message?.slice(0, 100) };
  }

  // Env check
  checks.anthropic = { ok: !!process.env.ANTHROPIC_API_KEY };
  checks.resend = { ok: !!process.env.RESEND_API_KEY };
  checks.stripe = { ok: !!process.env.STRIPE_SECRET_KEY };
  checks.dataforseo = { ok: !!process.env.DATAFORSEO_LOGIN };

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
