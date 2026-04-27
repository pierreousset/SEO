"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { decrypt } from "@/lib/encryption";
import { getSearchConsoleClient } from "@/lib/google-oauth";
import { classifyIntentRule } from "@/lib/llm/intent-classifier";
import { fetchCompetitorRankedKeywords, urlToDomain } from "@/lib/dataforseo";
import { generateKeywordSuggestions, type KeywordSuggestion } from "@/lib/llm/keyword-suggestions";
import { getUserPlan } from "@/lib/billing-helpers";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/billing-constants";

/**
 * Live GSC pull: ALL queries over the past N days (no tracked-keyword filter),
 * returns those NOT already tracked, sorted by opportunity score.
 *
 * Opportunity score = impressions × position_factor where position_factor
 * rewards being close to page 1 (positions 5-30 = highest leverage).
 */
export type DiscoveryQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  avgPosition: number;
  opportunityScore: number;
  daysSeen: number; // how many distinct days this query had impressions in the window
  firstSeenDate: string; // earliest date this query appeared
};

const UA = "SEODashboard-Discovery/1.0";

export async function discoverGscQueries(opts: {
  days?: number;
  minImpressions?: number;
}): Promise<{ queries: DiscoveryQuery[]; totalScanned: number; error?: string }> {
  const ctx = await requireAccountContext();
  const days = opts.days ?? 90;
  const minImpressions = opts.minImpressions ?? 10;

  const t = tenantDb(ctx.ownerId);
  const [gscToken, sites, keywords] = await Promise.all([
    t.selectGscToken(),
    t.selectSites(),
    t.selectKeywords(),
  ]);

  if (gscToken.length === 0) return { queries: [], totalScanned: 0, error: "GSC not connected" };
  const site = sites.find((s) => s.gscPropertyUri);
  if (!site) return { queries: [], totalScanned: 0, error: "no GSC site" };

  const refreshToken = decrypt(gscToken[0].encryptedRefreshToken);
  const sc = await getSearchConsoleClient(refreshToken);

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  // First pass: queries × dates so we can compute days_seen + first_seen.
  // Cap at 50k rows and 30s per page to avoid hanging the browser request.
  let startRow = 0;
  const PAGE = 25000;
  const MAX = 50000;
  const MAX_PAGES = Math.ceil(MAX / PAGE);
  type Row = { query: string; date: string; clicks: number; impressions: number; ctr: number; position: number };
  const all: Row[] = [];

  let pages = 0;
  while (startRow < MAX && pages < MAX_PAGES) {
    pages++;
    try {
      const res = await sc.searchanalytics.query(
        {
          siteUrl: site.gscPropertyUri!,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["query", "date"],
            rowLimit: PAGE,
            startRow,
          },
        },
        { signal: AbortSignal.timeout(30_000) },
      );
      const rows = res.data.rows ?? [];
      for (const r of rows) {
        all.push({
          query: (r.keys?.[0] ?? "").toString(),
          date: (r.keys?.[1] ?? "").toString(),
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        });
      }
      if (rows.length < PAGE) break;
      startRow += PAGE;
    } catch (err: any) {
      // Timeout or network error — return partial data instead of hanging
      console.warn(`[discoverGscQueries] page ${pages} failed:`, err?.message ?? err);
      break;
    }
  }

  // Aggregate by query
  type Agg = {
    clicks: number;
    impressions: number;
    positions: number[];
    dates: Set<string>;
    firstDate: string;
  };
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const trackedSet = new Set(keywords.filter((k) => !k.removedAt).map((k) => norm(k.query)));
  const byQuery = new Map<string, Agg>();

  for (const r of all) {
    if (!r.query) continue;
    let agg = byQuery.get(r.query);
    if (!agg) {
      agg = { clicks: 0, impressions: 0, positions: [], dates: new Set(), firstDate: r.date };
      byQuery.set(r.query, agg);
    }
    agg.clicks += r.clicks;
    agg.impressions += r.impressions;
    if (r.position > 0) agg.positions.push(r.position);
    agg.dates.add(r.date);
    if (r.date < agg.firstDate) agg.firstDate = r.date;
  }

  const queries: DiscoveryQuery[] = [];
  for (const [query, agg] of byQuery.entries()) {
    if (trackedSet.has(norm(query))) continue;
    if (agg.impressions < minImpressions) continue;
    const avgPosition =
      agg.positions.length > 0
        ? agg.positions.reduce((s, p) => s + p, 0) / agg.positions.length
        : 0;
    const positionFactor = positionLeverage(avgPosition);
    const opportunityScore = Math.round(agg.impressions * positionFactor);
    queries.push({
      query,
      clicks: agg.clicks,
      impressions: agg.impressions,
      ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
      avgPosition,
      opportunityScore,
      daysSeen: agg.dates.size,
      firstSeenDate: agg.firstDate,
    });
  }

  queries.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return { queries: queries.slice(0, 200), totalScanned: byQuery.size };
}

/** Higher = more leverage. Reward keywords near page 1 (5-15), penalize too-deep (>50). */
function positionLeverage(avgPos: number): number {
  if (avgPos === 0) return 0;
  if (avgPos >= 5 && avgPos <= 15) return 1.5;
  if (avgPos >= 4 && avgPos <= 20) return 1.2;
  if (avgPos >= 21 && avgPos <= 30) return 0.8;
  if (avgPos <= 3) return 0.4; // already top — low leverage from tracking
  if (avgPos <= 50) return 0.5;
  return 0.2;
}

/** Bulk add selected queries as tracked keywords. */
export async function bulkAddKeywords(queries: string[]): Promise<{ added: number; skipped: number }> {
  const ctx = await requireAccountContext();

  const t = tenantDb(ctx.ownerId);
  const [sites, profile] = await Promise.all([t.selectSites(), t.selectBusinessProfile()]);
  if (sites.length === 0) throw new Error("Connect GSC first");
  const siteId = sites[0].id;
  const cities = profile?.targetCities ?? [];

  let added = 0;
  let skipped = 0;
  for (const q of queries) {
    const query = q.trim();
    if (!query) continue;
    try {
      await db.insert(schema.keywords).values({
        id: randomUUID(),
        userId: ctx.ownerId,
        siteId,
        query,
        country: "fr",
        device: "desktop",
        intentStage: classifyIntentRule(query, cities),
      });
      added++;
    } catch (e: any) {
      // duplicate or constraint violation → skip silently
      skipped++;
    }
  }
  revalidatePath("/dashboard/keywords");
  revalidatePath("/dashboard/keywords/discover");
  return { added, skipped };
}

// ---------------------------------------------------------------------------
// Competitor keyword discovery — DataForSEO Labs ranked_keywords
// ---------------------------------------------------------------------------

export type CompetitorKeyword = {
  keyword: string;
  competitorDomain: string;
  competitorPosition: number | null;
  competitorUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  /** When multiple competitors rank for same keyword, store them all */
  alsoRankedBy: Array<{ domain: string; position: number }>;
};

export async function discoverCompetitorKeywords(opts: {
  minSearchVolume?: number;
  maxPosition?: number;
  locationCode?: number;
  languageCode?: string;
}): Promise<{ keywords: CompetitorKeyword[]; competitorsScanned: number; error?: string }> {
  const ctx = await requireAccountContext();

  const t = tenantDb(ctx.ownerId);
  const [profile, keywords] = await Promise.all([
    t.selectBusinessProfile(),
    t.selectKeywords(),
  ]);

  const competitorUrls = profile?.competitorUrls ?? [];
  if (competitorUrls.length === 0) {
    return {
      keywords: [],
      competitorsScanned: 0,
      error: "No competitors declared. Add 1-3 competitor URLs on /dashboard/business.",
    };
  }

  // Credits guard — free users with credits can still spend them.
  try {
    await debitCredits({
      userId: ctx.ownerId,
      amount: CREDIT_COSTS.competitorDiscovery,
      reason: "competitor_discovery",
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      const plan = await getUserPlan(ctx.ownerId);
      const msg =
        plan === "free"
          ? `Need ${e.required} credits, you have ${e.available}. Subscribe to Pro to buy packs.`
          : `Need ${e.required} credits, you have ${e.available}. Buy a pack on /dashboard/billing.`;
      return { keywords: [], competitorsScanned: 0, error: msg };
    }
    throw e;
  }

  const trackedNorm = new Set(
    keywords
      .filter((k) => !k.removedAt)
      .map((k) => k.query.toLowerCase().trim().replace(/\s+/g, " ")),
  );

  // Map domain → keyword → position so we can dedupe and note co-rankers
  const byKeyword = new Map<string, CompetitorKeyword>();

  for (const url of competitorUrls) {
    const domain = urlToDomain(url);
    try {
      const rows = await fetchCompetitorRankedKeywords(domain, {
        limit: 500,
        locationCode: opts.locationCode ?? 2250,
        languageCode: opts.languageCode ?? "fr",
      });
      for (const r of rows) {
        if (!r.keyword) continue;
        if ((opts.minSearchVolume ?? 0) > 0 && (r.searchVolume ?? 0) < (opts.minSearchVolume ?? 0)) continue;
        if (opts.maxPosition && r.competitorPosition && r.competitorPosition > opts.maxPosition) continue;

        const normKey = r.keyword.toLowerCase().trim().replace(/\s+/g, " ");
        if (trackedNorm.has(normKey)) continue; // already tracked → skip

        const existing = byKeyword.get(normKey);
        if (existing) {
          if (r.competitorPosition != null)
            existing.alsoRankedBy.push({ domain, position: r.competitorPosition });
          // Keep the best (lowest) position as the headline
          if (
            r.competitorPosition != null &&
            (existing.competitorPosition == null || r.competitorPosition < existing.competitorPosition)
          ) {
            existing.competitorPosition = r.competitorPosition;
            existing.competitorDomain = domain;
            existing.competitorUrl = r.competitorUrl;
          }
        } else {
          byKeyword.set(normKey, {
            keyword: r.keyword,
            competitorDomain: domain,
            competitorPosition: r.competitorPosition,
            competitorUrl: r.competitorUrl,
            searchVolume: r.searchVolume,
            cpc: r.cpc,
            keywordDifficulty: r.keywordDifficulty,
            alsoRankedBy:
              r.competitorPosition != null
                ? [{ domain, position: r.competitorPosition }]
                : [],
          });
        }
      }
    } catch (e: any) {
      console.warn(`[discoverCompetitorKeywords] ${domain} failed:`, e?.message ?? e);
      // Continue with next competitor
    }
  }

  const out = Array.from(byKeyword.values())
    // Sort by opportunity: keywords multiple competitors rank for = stronger signal
    .sort((a, b) => {
      const aScore = (a.searchVolume ?? 0) * (a.alsoRankedBy.length || 1);
      const bScore = (b.searchVolume ?? 0) * (b.alsoRankedBy.length || 1);
      return bScore - aScore;
    })
    .slice(0, 300);

  return { keywords: out, competitorsScanned: competitorUrls.length };
}

// ---------------------------------------------------------------------------
// AI-generated keyword suggestions from business context
// ---------------------------------------------------------------------------

export async function suggestKeywordsWithAI(): Promise<{
  suggestions: KeywordSuggestion[];
  error?: string;
}> {
  const ctx = await requireAccountContext();

  const t = tenantDb(ctx.ownerId);
  const [profile, keywords] = await Promise.all([
    t.selectBusinessProfile(),
    t.selectKeywords(),
  ]);

  if (!profile) {
    return {
      suggestions: [],
      error: "Fill the business profile first at /dashboard/business.",
    };
  }

  try {
    await debitCredits({
      userId: ctx.ownerId,
      amount: CREDIT_COSTS.aiSuggestions,
      reason: "ai_suggestions",
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      const plan = await getUserPlan(ctx.ownerId);
      const msg =
        plan === "free"
          ? `Need ${e.required} credits, you have ${e.available}. Subscribe to Pro to buy packs.`
          : `Need ${e.required} credits, you have ${e.available}. Buy a pack on /dashboard/billing.`;
      return { suggestions: [], error: msg };
    }
    throw e;
  }

  // Pull a sample of the user's GSC top queries as "already seen" signal to the LLM
  let topQueries: string[] = [];
  try {
    const gscRows = await db
      .select({ kwQuery: schema.keywords.query })
      .from(schema.gscMetrics)
      .innerJoin(schema.keywords, eq(schema.gscMetrics.keywordId, schema.keywords.id))
      .where(eq(schema.gscMetrics.userId, ctx.ownerId));
    topQueries = Array.from(new Set(gscRows.map((r) => r.kwQuery)));
  } catch {
    // ignore — just pass tracked keywords
  }

  const existingKeywords = keywords.filter((k) => !k.removedAt).map((k) => k.query);

  const suggestions = await generateKeywordSuggestions({
    profile,
    existingKeywords,
    gscTopQueries: topQueries,
  });

  return { suggestions };
}
