import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, SQL } from "drizzle-orm";
import * as schema from "./schema";

// Lazy: don't throw at import time (breaks `next build` in CI before env is set).
// Neon's client constructor accepts any string; queries will fail loudly if it's missing.
const sql = neon(process.env.DATABASE_URL ?? "postgresql://placeholder@localhost/db");
export const db = drizzle(sql, { schema });

/**
 * Tenant-scoped query builder.
 *
 * Security primitive: every call to `tenantDb(userId)` returns a wrapper that
 * injects `where userId = ?` on select/update/delete against tenant-owned tables.
 *
 * Callers MUST use this wrapper for any query touching user data. Never use the
 * raw `db` export inside a route handler that serves a logged-in user.
 *
 * Usage:
 *   const t = tenantDb(session.user.id);
 *   const rows = await t.selectKeywords();
 */
export function tenantDb(userId: string) {
  const scopedEq = (column: SQL | any) => eq(column, userId);

  return {
    userId,

    selectKeywords: () =>
      db.select().from(schema.keywords).where(and(eq(schema.keywords.userId, userId))),

    selectSites: () =>
      db.select().from(schema.sites).where(eq(schema.sites.userId, userId)),

    selectPositionsForKeyword: (keywordId: string) =>
      db
        .select()
        .from(schema.positions)
        .where(
          and(eq(schema.positions.userId, userId), eq(schema.positions.keywordId, keywordId)),
        ),

    selectLatestBrief: () =>
      db
        .select()
        .from(schema.briefs)
        .where(eq(schema.briefs.userId, userId))
        .orderBy(schema.briefs.periodStart)
        .limit(1),

    selectGscToken: () =>
      db.select().from(schema.gscTokens).where(eq(schema.gscTokens.userId, userId)).limit(1),

    selectBusinessProfile: async () => {
      const rows = await db
        .select()
        .from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    },

    upsertBusinessProfile: (
      values: Omit<typeof schema.businessProfiles.$inferInsert, "userId" | "updatedAt">,
    ) =>
      db
        .insert(schema.businessProfiles)
        .values({ ...values, userId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: schema.businessProfiles.userId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning(),

    selectRecentFetchRuns: (limit = 5) =>
      db
        .select()
        .from(schema.fetchRuns)
        .where(eq(schema.fetchRuns.userId, userId))
        .orderBy(schema.fetchRuns.queuedAt)
        .limit(limit),

    // For writes, callers use db.insert/update/delete directly but MUST include
    // `userId = t.userId` in the values or where clause. Helpers below enforce this.
    insertKeyword: (values: Omit<typeof schema.keywords.$inferInsert, "userId">) =>
      db.insert(schema.keywords).values({ ...values, userId }).returning(),

    insertSite: (values: Omit<typeof schema.sites.$inferInsert, "userId">) =>
      db.insert(schema.sites).values({ ...values, userId }).returning(),

    // Write position row — must be tenant-scoped
    insertPosition: (values: Omit<typeof schema.positions.$inferInsert, "userId">) =>
      db.insert(schema.positions).values({ ...values, userId }).returning(),

    insertBrief: (values: Omit<typeof schema.briefs.$inferInsert, "userId">) =>
      db.insert(schema.briefs).values({ ...values, userId }).returning(),

    upsertGscToken: (encryptedRefreshToken: string, scope: string) =>
      db
        .insert(schema.gscTokens)
        .values({ userId, encryptedRefreshToken, scope })
        .onConflictDoUpdate({
          target: schema.gscTokens.userId,
          set: { encryptedRefreshToken, scope, lastRefreshedAt: new Date() },
        })
        .returning(),

    _scopedEq: scopedEq,
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;
export { schema };
