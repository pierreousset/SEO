// Cannibalization detection — analyses GSC query × page data to find queries
// where multiple URLs from your site compete against each other.
//
// A query is "cannibalized" when:
//   - >= 2 of your URLs received meaningful impressions
//   - no URL holds the dominant share (> 80%) of impressions
//
// Severity heuristic:
//   high   — top URL < 50% share AND total impressions >= 100/month equiv
//   medium — top URL < 70% share AND total impressions >= 50/month equiv
//   low    — anything else that triggered the gate

export type GscQueryPageRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type CannibalizationFinding = {
  query: string;
  trackedKeywordId: string | null;
  severity: "high" | "medium" | "low";
  totalImpressions: number;
  totalClicks: number;
  urls: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
    share: number; // fraction of query impressions on this URL (0..1)
  }>;
};

const MIN_URL_IMPRESSIONS = 5; // URL must have >= this many to "compete"
const MIN_TOTAL_IMPRESSIONS = 20; // total query impressions to even consider
const DOMINANT_THRESHOLD = 0.8; // if top URL > 80% → no cannibalization

export function detectCannibalization(
  rows: GscQueryPageRow[],
  trackedKeywords: Array<{ id: string; query: string }>,
): CannibalizationFinding[] {
  // Build tracked lookup with case-insensitive normalization.
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const trackedByQuery = new Map(trackedKeywords.map((k) => [norm(k.query), k.id]));

  // Group rows by query.
  const byQuery = new Map<string, GscQueryPageRow[]>();
  for (const r of rows) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, []);
    byQuery.get(r.query)!.push(r);
  }

  const findings: CannibalizationFinding[] = [];

  for (const [query, pageRows] of byQuery) {
    // Filter URLs with meaningful impressions; need >= 2 to cannibalize.
    const competing = pageRows.filter((r) => r.impressions >= MIN_URL_IMPRESSIONS);
    if (competing.length < 2) continue;

    const totalImpressions = competing.reduce((s, r) => s + r.impressions, 0);
    if (totalImpressions < MIN_TOTAL_IMPRESSIONS) continue;

    // Sort by impressions descending.
    competing.sort((a, b) => b.impressions - a.impressions);
    const topShare = competing[0].impressions / totalImpressions;
    if (topShare >= DOMINANT_THRESHOLD) continue;

    const totalClicks = competing.reduce((s, r) => s + r.clicks, 0);

    // Severity heuristic.
    const scaleTo28 = 1; // window is already 28d
    const volScore = totalImpressions * scaleTo28;
    let severity: CannibalizationFinding["severity"] = "low";
    if (topShare < 0.5 && volScore >= 100) severity = "high";
    else if (topShare < 0.7 && volScore >= 50) severity = "medium";

    findings.push({
      query,
      trackedKeywordId: trackedByQuery.get(norm(query)) ?? null,
      severity,
      totalImpressions,
      totalClicks,
      urls: competing.map((r) => ({
        page: r.page,
        clicks: r.clicks,
        impressions: r.impressions,
        position: Number(r.position.toFixed(1)),
        share: Number((r.impressions / totalImpressions).toFixed(3)),
      })),
    });
  }

  // High-severity first, then by total impressions.
  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  findings.sort(
    (a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      b.totalImpressions - a.totalImpressions,
  );

  return findings;
}
