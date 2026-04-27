/**
 * Auto competitor discovery — scans the user's own SERP data (competitor_positions)
 * and surfaces the domains that keep showing up in their top 10. No new fetch:
 * we already captured the full SERP for every tracked keyword during daily pulls.
 *
 * Ranking blends:
 *   - coverage: how many of the user's keywords the domain ranks on
 *   - strength: average position (top 3 > 4-10)
 *   - freshness: appeared in the latest snapshot (decayed if only in older dates)
 */

export type DiscoveryRow = {
  keywordId: string;
  competitorDomain: string;
  date: string;
  position: number | null;
  url: string | null;
};

export type CompetitorSuggestion = {
  domain: string;
  sampleUrl: string | null;
  keywordCount: number; // distinct keywords where this domain ranked in top 10
  avgPosition: number;
  bestPosition: number;
  score: number;
};

const TOP_N = 10;

export function suggestCompetitors(
  rows: DiscoveryRow[],
  excludeDomains: Set<string>,
  limit = 8,
): CompetitorSuggestion[] {
  // Normalise excluded domains (strip www. + lowercase).
  const norm = (d: string) => d.replace(/^www\./, "").toLowerCase();
  const excluded = new Set([...excludeDomains].map(norm));

  // Aggregate: per competitor domain, which keywords they rank on and at what position.
  type Agg = {
    keywordPositions: Map<string, number>; // keywordId -> best position
    sampleUrl: string | null;
  };
  const byDomain = new Map<string, Agg>();

  for (const r of rows) {
    if (r.position == null || r.position > TOP_N) continue;
    const d = norm(r.competitorDomain);
    if (!d || excluded.has(d)) continue;
    if (!byDomain.has(d)) byDomain.set(d, { keywordPositions: new Map(), sampleUrl: null });
    const agg = byDomain.get(d)!;
    const prev = agg.keywordPositions.get(r.keywordId);
    if (prev == null || r.position < prev) {
      agg.keywordPositions.set(r.keywordId, r.position);
      if (r.url) agg.sampleUrl = r.url;
    }
  }

  const suggestions: CompetitorSuggestion[] = [];
  for (const [domain, agg] of byDomain) {
    const positions = [...agg.keywordPositions.values()];
    if (positions.length === 0) continue;

    const avgPosition = positions.reduce((s, p) => s + p, 0) / positions.length;
    const bestPosition = Math.min(...positions);
    const count = positions.length;

    // Score: keyword coverage × position quality.
    // Position quality = 1 for #1, fades to 0 at #10+.
    const posQuality = Math.max(0, (11 - avgPosition) / 10);
    const score = count * (1 + posQuality);

    suggestions.push({
      domain,
      sampleUrl: agg.sampleUrl,
      keywordCount: count,
      avgPosition: Number(avgPosition.toFixed(1)),
      bestPosition,
      score: Number(score.toFixed(2)),
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, limit);
}
