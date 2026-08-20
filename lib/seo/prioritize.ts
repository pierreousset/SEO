import { expectedCtr } from "@/lib/seo-score";

/**
 * Opportunity selector — the deterministic core of the "3 fixes" product.
 *
 * Input is per-keyword GSC rows (already windowed by the caller, e.g. last 28d).
 * We aggregate to one opportunity per keyword and score by INCREMENTAL CLICKS:
 * how many extra clicks the keyword would earn if its CTR matched the benchmark
 * CTR for the position it already holds. This surfaces "you rank fine but the
 * title/meta isn't pulling clicks" — a real, fixable win grounded in the owner's
 * own Search Console data, not the LLM's guesses.
 *
 *   score = impressions * max(0, expectedCtr(avgPosition) - currentCtr)
 *
 * The LLM is deliberately NOT in this ranking. It writes the fix copy AFTER we
 * have chosen the opportunities (see writeFix). This is why the join is free:
 * we start from real GSC rows that already carry keywordId.
 *
 *   gscMetrics (per keyword/day)                      keywords
 *     │ aggregate over window                           │ id → query
 *     ▼                                                 ▼
 *   { keywordId, impressions, clicks, avgPosition } ──join── query
 *     ▼ score = impressions*(expectedCtr(pos)-ctr)
 *   sort desc, stable tie-break, take UP TO 3  ──►  Opportunity[]
 *
 * Contract: returns UP TO 3 opportunities. Never pads to 3 — if fewer keywords
 * have a positive opportunity, fewer come back (honest "not enough data" for
 * cold-start sites is the caller's job to message).
 *
 * v1 refinements (see TODOS.md): group by page, value position-climb gains.
 */

/** A single per-keyword/day GSC metric row. Matches db `gscMetrics`, but the
 *  caller must have parsed the text columns (ctr, gscPosition) to numbers. */
export type GscMetricRow = {
  keywordId: string;
  impressions: number;
  clicks: number;
  /** Click-through rate as a fraction 0-1. */
  ctr: number;
  /** Average GSC position (fractional, e.g. 11.4). */
  gscPosition: number;
};

export type KeywordRef = {
  id: string;
  query: string;
};

export type Opportunity = {
  keywordId: string;
  query: string;
  impressions: number;
  clicks: number;
  avgPosition: number;
  currentCtr: number;
  benchmarkCtr: number;
  /** Extra clicks per period if CTR reached the benchmark for this position. */
  incrementalClicks: number;
};

type Agg = {
  impressions: number;
  clicks: number;
  // impression-weighted position sum, divided out at the end
  weightedPositionSum: number;
};

/**
 * Select the top opportunities from windowed GSC rows.
 *
 * @param gscMetrics per-keyword/day rows (parsed to numbers)
 * @param keywords   keyword id → query lookup source
 * @param limit      max opportunities to return (default 3)
 */
export function selectOpportunities(
  gscMetrics: GscMetricRow[],
  keywords: KeywordRef[],
  limit = 3,
): Opportunity[] {
  if (limit <= 0) return [];

  const queryById = new Map(keywords.map((k) => [k.id, k.query]));

  // Aggregate rows per keyword across the window.
  const byKeyword = new Map<string, Agg>();
  for (const row of gscMetrics) {
    // Guard against null/NaN from unparsed or missing columns.
    const impressions = Number.isFinite(row.impressions) ? row.impressions : 0;
    const clicks = Number.isFinite(row.clicks) ? row.clicks : 0;
    const position = Number.isFinite(row.gscPosition) ? row.gscPosition : 0;
    if (impressions <= 0) continue; // no impressions = no opportunity signal

    const agg = byKeyword.get(row.keywordId) ?? {
      impressions: 0,
      clicks: 0,
      weightedPositionSum: 0,
    };
    agg.impressions += impressions;
    agg.clicks += clicks;
    agg.weightedPositionSum += position * impressions;
    byKeyword.set(row.keywordId, agg);
  }

  const opportunities: Opportunity[] = [];
  for (const [keywordId, agg] of byKeyword) {
    if (agg.impressions <= 0) continue;
    const avgPosition = agg.weightedPositionSum / agg.impressions;
    if (avgPosition <= 0) continue; // no real ranking → can't score

    const currentCtr = agg.clicks / agg.impressions;
    const benchmarkCtr = expectedCtr(avgPosition);
    const ctrGap = benchmarkCtr - currentCtr;
    if (ctrGap <= 0) continue; // already at/above benchmark → not an opportunity

    const incrementalClicks = agg.impressions * ctrGap;
    if (incrementalClicks <= 0) continue;

    opportunities.push({
      keywordId,
      query: queryById.get(keywordId) ?? keywordId,
      impressions: agg.impressions,
      clicks: agg.clicks,
      avgPosition,
      currentCtr,
      benchmarkCtr,
      incrementalClicks,
    });
  }

  // Sort by opportunity desc. Stable, deterministic tie-break so the same data
  // always yields the same top 3: incrementalClicks → impressions → keywordId.
  opportunities.sort(
    (a, b) =>
      b.incrementalClicks - a.incrementalClicks ||
      b.impressions - a.impressions ||
      a.keywordId.localeCompare(b.keywordId),
  );

  return opportunities.slice(0, limit);
}
