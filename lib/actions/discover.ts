"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { decrypt } from "@/lib/encryption";
import { getSearchConsoleClient } from "@/lib/google-oauth";
import { classifyIntentRule } from "@/lib/llm/intent-classifier";
import {
  fetchCompetitorRankedKeywords,
  fetchKeywordIdeas,
  fetchKeywordsForSite,
  urlToDomain,
} from "@/lib/dataforseo";
import { generateKeywordSuggestions, type KeywordSuggestion } from "@/lib/llm/keyword-suggestions";
import { cooldownRemainingMs, formatRetryWait, guardMonthlyUsage, lastUsageUpdatedAt } from "@/lib/usage";
import { KEYWORD_IDEAS_COOLDOWN_MS, MONTHLY_LIMITS } from "@/lib/billing-constants";
import { getLocale } from "@/lib/i18n-server";
import {
  buildKeywordSeeds,
  keywordMarket,
  mergeKeywordIdeas,
  type SeoKeywordIdea,
} from "@/lib/seo/keyword-ideas";

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

export type KeywordToAdd = {
  query: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  cpc?: number | null;
  searchIntent?: string | null;
};

/** Bulk add selected queries as tracked keywords. */
export async function bulkAddKeywords(
  input: string[] | KeywordToAdd[],
): Promise<{ added: number; skipped: number }> {
  const ctx = await requireAccountContext();

  const t = tenantDb(ctx.ownerId);
  const [sites, profile] = await Promise.all([t.selectSites(), t.selectBusinessProfile()]);
  if (sites.length === 0) throw new Error("Connect GSC first");
  const siteId = sites[0].id;
  const cities = profile?.targetCities ?? [];
  const items: KeywordToAdd[] = input.map((x) => (typeof x === "string" ? { query: x } : x));

  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const query = item.query.trim();
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
        searchVolume: item.searchVolume ?? null,
        keywordDifficulty: item.keywordDifficulty ?? null,
        cpc: item.cpc ?? null,
        searchIntent: item.searchIntent ?? null,
        volumeUpdatedAt: item.searchVolume != null ? new Date() : null,
      });
      added++;
    } catch {
      skipped++;
    }
  }

  const addedQueries = items
    .map((x) => x.query.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
  if (added > 0 && addedQueries.length > 0) {
    await pruneKeywordIdeaSnapshot(ctx.ownerId, addedQueries);
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

  // Fair-use guard — flat 99€/mo, monthly limit instead of credits.
  const usage = await guardMonthlyUsage(ctx.ownerId, "competitorDiscovery");
  if (!usage.ok) {
    return { keywords: [], competitorsScanned: 0, error: usage.error };
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

  // BYOK: skip the fair-use limit if user has their own Anthropic key.
  const { getApiKeyStatus } = await import("@/lib/actions/api-keys");
  const keyStatus = await getApiKeyStatus(ctx.ownerId);
  if (!(keyStatus.byokEnabled && keyStatus.anthropic)) {
    const usage = await guardMonthlyUsage(ctx.ownerId, "aiSuggestions");
    if (!usage.ok) return { suggestions: [], error: usage.error };
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
    userId: ctx.ownerId,
  });

  return { suggestions };
}

// ---------------------------------------------------------------------------
// SEO keyword ideas — DataForSEO volume / difficulty / intent (not GSC)
// ---------------------------------------------------------------------------

function normQuery(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function isIdeaSource(v: unknown): v is SeoKeywordIdea["source"] {
  return v === "ideas" || v === "site";
}

function parseSavedIdeas(raw: unknown): SeoKeywordIdea[] {
  if (!Array.isArray(raw)) return [];
  const out: SeoKeywordIdea[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const rec = row as Record<string, unknown>;
    const keyword = typeof rec.keyword === "string" ? normQuery(rec.keyword) : "";
    if (!keyword) continue;
    out.push({
      keyword,
      searchVolume: typeof rec.searchVolume === "number" ? rec.searchVolume : null,
      keywordDifficulty: typeof rec.keywordDifficulty === "number" ? rec.keywordDifficulty : null,
      cpc: typeof rec.cpc === "number" ? rec.cpc : null,
      competition: typeof rec.competition === "number" ? rec.competition : null,
      intent: typeof rec.intent === "string" ? rec.intent : null,
      source: isIdeaSource(rec.source) ? rec.source : "ideas",
      opportunityScore: typeof rec.opportunityScore === "number" ? rec.opportunityScore : 0,
    });
  }
  return out;
}

async function trackedQuerySet(userId: string): Promise<Set<string>> {
  const rows = await tenantDb(userId).selectKeywords();
  return new Set(
    rows.filter((k) => !k.removedAt).map((k) => normQuery(k.query)),
  );
}

async function readKeywordIdeaSnapshot(userId: string): Promise<{
  keywords: SeoKeywordIdea[];
  seeds: string[];
  sourcesUsed: Array<"ideas" | "site">;
  fetchedAt: string | null;
}> {
  const [row] = await db
    .select()
    .from(schema.keywordIdeaSnapshots)
    .where(eq(schema.keywordIdeaSnapshots.userId, userId))
    .limit(1);
  if (!row) {
    return { keywords: [], seeds: [], sourcesUsed: [], fetchedAt: null };
  }
  const tracked = await trackedQuerySet(userId);
  const seeds = Array.isArray(row.seeds) ? row.seeds.filter((s): s is string => typeof s === "string") : [];
  const sourcesUsed = Array.isArray(row.sourcesUsed)
    ? row.sourcesUsed.filter(isIdeaSource)
    : [];
  return {
    keywords: parseSavedIdeas(row.keywords).filter((k) => !tracked.has(k.keyword)),
    seeds,
    sourcesUsed,
    fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : null,
  };
}

async function saveKeywordIdeaSnapshot(
  userId: string,
  keywords: SeoKeywordIdea[],
  seeds: string[],
  sourcesUsed: Array<"ideas" | "site">,
): Promise<void> {
  await db
    .insert(schema.keywordIdeaSnapshots)
    .values({
      userId,
      keywords,
      seeds,
      sourcesUsed,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.keywordIdeaSnapshots.userId,
      set: {
        keywords,
        seeds,
        sourcesUsed,
        fetchedAt: new Date(),
      },
    });
}

async function pruneKeywordIdeaSnapshot(userId: string, addedNorm: string[]): Promise<void> {
  const drop = new Set(addedNorm.map(normQuery));
  const [row] = await db
    .select()
    .from(schema.keywordIdeaSnapshots)
    .where(eq(schema.keywordIdeaSnapshots.userId, userId))
    .limit(1);
  if (!row) return;
  const next = parseSavedIdeas(row.keywords).filter((k) => !drop.has(k.keyword));
  await db
    .update(schema.keywordIdeaSnapshots)
    .set({ keywords: next })
    .where(eq(schema.keywordIdeaSnapshots.userId, userId));
}

export async function listSavedKeywordIdeas(): Promise<{
  keywords: SeoKeywordIdea[];
  seeds: string[];
  sourcesUsed: Array<"ideas" | "site">;
  fetchedAt: string | null;
}> {
  const ctx = await requireAccountContext();
  return readKeywordIdeaSnapshot(ctx.ownerId);
}

export async function discoverSeoKeywordIdeas(opts: {
  minSearchVolume?: number;
} = {}): Promise<{
  keywords: SeoKeywordIdea[];
  seeds: string[];
  sourcesUsed: Array<"ideas" | "site">;
  fetchedAt: string | null;
  error?: string;
}> {
  const ctx = await requireAccountContext();
  const t = tenantDb(ctx.ownerId);
  const saved = await readKeywordIdeaSnapshot(ctx.ownerId);
  const [profile, keywords, sites] = await Promise.all([
    t.selectBusinessProfile(),
    t.selectKeywords(),
    t.selectSites(),
  ]);

  const { locationCode, languageCode } = keywordMarket(profile?.preferredLanguage);
  const seeds = buildKeywordSeeds({
    primaryService: profile?.primaryService,
    secondaryServices: profile?.secondaryServices ?? [],
    targetCities: profile?.targetCities ?? [],
  });
  const domain = sites[0]?.domain ? urlToDomain(sites[0].domain) : "";

  if (seeds.length === 0 && !domain) {
    return {
      ...saved,
      error:
        "Renseignez le service principal (et les villes) dans le profil business, ou connectez un site.",
    };
  }

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return {
      ...saved,
      seeds: saved.seeds.length > 0 ? saved.seeds : seeds,
      error: "DataForSEO n'est pas configuré (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).",
    };
  }

  const hasSaved = saved.keywords.length > 0;
  if (hasSaved) {
    const lastAt = await lastUsageUpdatedAt(ctx.ownerId, "keywordIdeas");
    const waitMs = cooldownRemainingMs(lastAt, KEYWORD_IDEAS_COOLDOWN_MS);
    if (waitMs > 0) {
      const lng = await getLocale();
      const wait = formatRetryWait(waitMs);
      const cap = MONTHLY_LIMITS.keywordIdeas ?? 8;
      return {
        ...saved,
        error:
          lng === "en"
            ? `Keyword research is limited to ${cap}/month. Try again in ${wait}.`
            : `Recherche limitée à ${cap}/mois. Réessayez dans ${wait}.`,
      };
    }

    const usage = await guardMonthlyUsage(ctx.ownerId, "keywordIdeas");
    if (!usage.ok) {
      return { ...saved, error: usage.error };
    }
  }

  const minVolume = opts.minSearchVolume ?? 10;
  const trackedNorm = new Set(
    keywords
      .filter((k) => !k.removedAt)
      .map((k) => k.query.toLowerCase().trim().replace(/\s+/g, " ")),
  );

  const sourcesUsed: Array<"ideas" | "site"> = [];
  const settled = await Promise.allSettled([
    seeds.length > 0
      ? fetchKeywordIdeas(seeds, { locationCode, languageCode, minVolume, limit: 200 })
      : Promise.resolve([] as SeoKeywordIdea[]),
    domain
      ? fetchKeywordsForSite(domain, { locationCode, languageCode, minVolume, limit: 200 })
      : Promise.resolve([] as SeoKeywordIdea[]),
  ]);

  const collected: SeoKeywordIdea[] = [];
  if (settled[0].status === "fulfilled") {
    if (settled[0].value.length > 0) sourcesUsed.push("ideas");
    collected.push(...settled[0].value);
  } else {
    console.warn("[discoverSeoKeywordIdeas] keyword_ideas failed:", settled[0].reason);
  }
  if (settled[1].status === "fulfilled") {
    if (settled[1].value.length > 0) sourcesUsed.push("site");
    collected.push(...settled[1].value);
  } else {
    console.warn("[discoverSeoKeywordIdeas] keywords_for_site failed:", settled[1].reason);
  }

  if (collected.length === 0) {
    const firstErr =
      settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    return {
      ...saved,
      error:
        firstErr?.reason instanceof Error
          ? firstErr.reason.message
          : "Aucun mot-clé trouvé. Vérifiez le profil business ou DataForSEO.",
    };
  }

  const merged = mergeKeywordIdeas(collected)
    .filter((row) => !trackedNorm.has(row.keyword))
    .filter((row) => (row.searchVolume ?? 0) >= minVolume)
    .slice(0, 250);

  await saveKeywordIdeaSnapshot(ctx.ownerId, merged, seeds, sourcesUsed);
  if (!hasSaved) {
    await guardMonthlyUsage(ctx.ownerId, "keywordIdeas");
  }
  const fetchedAt = new Date().toISOString();
  return { keywords: merged, seeds, sourcesUsed, fetchedAt };
}
