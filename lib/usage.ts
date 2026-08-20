import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { MONTHLY_LIMITS, type MeteredAction } from "@/lib/billing-constants";

/**
 * Fair-use enforcement — the flat-99€/mo replacement for credits.
 *
 * Instead of debiting a wallet, each metered action increments a per-month
 * counter and is allowed while it stays under the action's MONTHLY_LIMITS cap.
 * Unlimited actions (limit = null) never touch the DB. Caps reset each calendar
 * month automatically because the counter is keyed by the YYYY-MM period bucket.
 *
 *   limit null?  ── yes ─►  allow (no counting)
 *        │ no
 *        ▼
 *   atomic upsert monthly_usage SET count=count+1 WHERE count < limit
 *        │ row returned? ── yes ─► allow
 *        └ no ─► over limit → deny
 */

export type UsageResult =
  | { ok: true; unlimited?: boolean }
  | { ok: false; error: string; limit: number; period: string };

/** UTC month bucket, e.g. "2026-07". */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Atomically consume one unit of a metered action's monthly allowance.
 * Call BEFORE running the expensive action. Returns ok:false (never throws)
 * when the monthly limit is reached.
 */
export async function guardMonthlyUsage(
  userId: string,
  action: MeteredAction,
): Promise<UsageResult> {
  const limit = MONTHLY_LIMITS[action];
  if (limit === null) return { ok: true, unlimited: true };

  const period = currentPeriod();

  // Atomic: insert count=1, or increment only while under the cap. When the
  // row is already at the cap, setWhere is false, the UPDATE is skipped, and
  // RETURNING yields nothing → over limit. Mirrors the guarded-UPDATE pattern
  // in lib/credits.ts (Neon HTTP has no real transactions).
  try {
    const rows = await db
      .insert(schema.monthlyUsage)
      .values({ userId, action, period, count: 1 })
      .onConflictDoUpdate({
        target: [
          schema.monthlyUsage.userId,
          schema.monthlyUsage.action,
          schema.monthlyUsage.period,
        ],
        set: { count: sql`${schema.monthlyUsage.count} + 1`, updatedAt: new Date() },
        setWhere: sql`${schema.monthlyUsage.count} < ${limit}`,
      })
      .returning({ count: schema.monthlyUsage.count });

    if (rows.length === 0) {
      return {
        ok: false,
        error: `Limite mensuelle atteinte pour cette action (${limit}/mois). Elle se réinitialise le 1er du mois prochain.`,
        limit,
        period,
      };
    }
    return { ok: true };
  } catch (err) {
    // Don't fail the product (audit/brief/…) because the counter table is
    // missing or the query errored. Metering is fail-open; log and continue.
    console.error("[usage] monthly_usage upsert failed:", err);
    return { ok: true };
  }
}

/** Last time this action was counted this month, or null. */
export async function lastUsageUpdatedAt(
  userId: string,
  action: MeteredAction,
): Promise<Date | null> {
  const period = currentPeriod();
  const [row] = await db
    .select({ updatedAt: schema.monthlyUsage.updatedAt })
    .from(schema.monthlyUsage)
    .where(
      and(
        eq(schema.monthlyUsage.userId, userId),
        eq(schema.monthlyUsage.action, action),
        eq(schema.monthlyUsage.period, period),
      ),
    )
    .limit(1);
  return row?.updatedAt ?? null;
}

/** Milliseconds left in a cooldown, 0 if the next call is allowed. */
export function cooldownRemainingMs(
  lastAt: Date | null,
  cooldownMs: number,
  now: number = Date.now(),
): number {
  if (!lastAt || cooldownMs <= 0) return 0;
  return Math.max(0, lastAt.getTime() + cooldownMs - now);
}

export function formatRetryWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.ceil(minutes / 60)} h`;
}

/** Read current-month usage for a user (for optional UI display). */
export async function getMonthlyUsage(
  userId: string,
): Promise<Record<string, number>> {
  const period = currentPeriod();
  const rows = await db
    .select({ action: schema.monthlyUsage.action, count: schema.monthlyUsage.count })
    .from(schema.monthlyUsage)
    .where(
      sql`${schema.monthlyUsage.userId} = ${userId} AND ${schema.monthlyUsage.period} = ${period}`,
    );
  return Object.fromEntries(rows.map((r) => [r.action, r.count]));
}
