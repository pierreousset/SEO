import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema, tenantDb } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import {
  listSites,
  fetchTopQueries,
  fetchGscSiteTotals,
  siteUrlToDomain,
} from "@/lib/google-oauth";
import { classifyIntentRule } from "@/lib/llm/intent-classifier";
import { FREE_LIMITS } from "@/lib/billing-constants";
import { getUserPlan } from "@/lib/billing-helpers";

export type GscBootstrapResult = {
  siteUrl: string | null;
  keywordCount: number;
  totalsDays: number;
  queuedPull: boolean;
  warning?: string;
};

/**
 * After OAuth: pick a GSC property, import top queries as keywords, pull
 * 30 days of site totals so the dashboard isn't empty, then queue the
 * full history job (needs Inngest).
 */
export async function bootstrapGscForUser(
  userId: string,
  refreshToken: string,
): Promise<GscBootstrapResult> {
  const t = tenantDb(userId);
  const existingSites = await t.selectSites();

  let siteUrl: string | null =
    existingSites.find((s) => s.gscPropertyUri)?.gscPropertyUri ?? null;
  let keywordCount = (await t.selectKeywords()).filter((k) => !k.removedAt).length;

  if (existingSites.length === 0) {
    const properties = await listSites(refreshToken);
    if (properties.length === 0) {
      return {
        siteUrl: null,
        keywordCount: 0,
        totalsDays: 0,
        queuedPull: false,
        warning: "no_property",
      };
    }

    let chosen = properties[0];
    let topQueries: Awaited<ReturnType<typeof fetchTopQueries>> = [];
    for (const property of properties) {
      if (!property.siteUrl) continue;
      const rows = await fetchTopQueries(refreshToken, property.siteUrl, 20);
      if (rows.length > 0) {
        chosen = property;
        topQueries = rows;
        break;
      }
    }
    if (topQueries.length === 0 && chosen.siteUrl) {
      topQueries = await fetchTopQueries(refreshToken, chosen.siteUrl, 20);
    }

    siteUrl = chosen.siteUrl ?? null;
    if (!siteUrl) {
      return {
        siteUrl: null,
        keywordCount: 0,
        totalsDays: 0,
        queuedPull: false,
        warning: "no_property",
      };
    }

    const domain = siteUrlToDomain(siteUrl);
    const [siteRow] = await t.insertSite({
      id: randomUUID(),
      domain,
      gscPropertyUri: siteUrl,
    });

    const profile = await t.selectBusinessProfile();
    const cities = profile?.targetCities ?? [];
    for (const q of topQueries) {
      if (!q.query.trim()) continue;
      await t.insertKeyword({
        id: randomUUID(),
        siteId: siteRow.id,
        query: q.query,
        country: "fr",
        device: "desktop",
        intentStage: classifyIntentRule(q.query, cities),
      });
    }
    keywordCount = topQueries.filter((q) => q.query.trim()).length;
  }

  let totalsDays = 0;
  if (siteUrl) {
    try {
      const totals = await fetchGscSiteTotals(refreshToken, siteUrl, 30);
      if (totals.length > 0) {
        await db
          .insert(schema.gscSiteMetrics)
          .values(
            totals.map((r) => ({
              id: randomUUID(),
              userId,
              date: r.date,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: r.ctr.toString(),
              position: r.position.toString(),
            })),
          )
          .onConflictDoUpdate({
            target: [schema.gscSiteMetrics.userId, schema.gscSiteMetrics.date],
            set: {
              clicks: sql`excluded.clicks`,
              impressions: sql`excluded.impressions`,
              ctr: sql`excluded.ctr`,
              position: sql`excluded.position`,
              fetchedAt: new Date(),
            },
          });
        totalsDays = totals.length;
      }
    } catch (err) {
      console.warn("[gsc-bootstrap] site totals failed:", err);
    }
  }

  let queuedPull = false;
  if (siteUrl && keywordCount > 0) {
    try {
      const plan = await getUserPlan(userId);
      const days =
        plan === "free" ? FREE_LIMITS.gscHistoryDaysMax : 90;
      const runId = randomUUID();
      await db.insert(schema.gscRuns).values({
        id: runId,
        userId,
        source: "manual",
        status: "queued",
        daysRequested: days,
      });
      await inngest.send({
        name: "gsc/history.pull",
        data: { userId, runId, days },
      });
      queuedPull = true;
    } catch (err) {
      console.warn("[gsc-bootstrap] queue pull failed:", err);
    }
  }

  if (keywordCount > 0 || totalsDays > 0) {
    try {
      const { recomputeSeoScore } = await import("@/lib/seo-score-recompute");
      await recomputeSeoScore(userId);
    } catch (err) {
      console.warn("[gsc-bootstrap] score failed:", err);
    }
  }

  return {
    siteUrl,
    keywordCount,
    totalsDays,
    queuedPull,
    warning: keywordCount === 0 ? "no_queries" : undefined,
  };
}
