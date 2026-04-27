/**
 * Content refresh radar — detects pages and keywords whose rank/traffic has
 * been drifting downward for 4+ weeks. Pure compute from existing GSC data —
 * no extra fetch. Surface candidates for a content refresh.
 *
 * Method: simple linear regression slope on the time series. If slope is
 * negative and meaningful, flag it. Severity = |slope| × volume weight.
 */

export type PageSeries = {
  url: string;
  points: Array<{ date: string; clicks: number; impressions: number; position: number }>;
};

export type KeywordSeries = {
  keywordId: string;
  keyword: string;
  points: Array<{ date: string; position: number; clicks: number }>;
};

export type RefreshCandidate = {
  kind: "page" | "keyword";
  id: string;
  label: string; // URL for pages, query for keywords
  severity: "high" | "medium" | "low";
  weeklyDelta: number; // signed change per week. Negative = worsening.
  totalWindowDays: number;
  totals: {
    clicks: number;
    impressions: number;
    avgPosition: number;
  };
  firstDate: string;
  lastDate: string;
};

const MIN_POINTS = 21; // need ~3 weeks of data to call a trend
const MIN_IMPRESSIONS_WINDOW = 100; // ignore anything too small to matter

/**
 * Compute linear regression slope (y vs x index). Used to estimate daily
 * change in clicks / impressions / position.
 */
function slopeOf(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Detect refresh candidates across page-level GSC data.
 * "Declining" = either:
 *   - clicks slope meaningfully negative (users arriving less)
 *   - OR position worsening (slope positive — position numbers grow down)
 */
export function detectPageRefreshCandidates(
  series: PageSeries[],
): RefreshCandidate[] {
  const out: RefreshCandidate[] = [];

  for (const s of series) {
    if (s.points.length < MIN_POINTS) continue;
    s.points.sort((a, b) => a.date.localeCompare(b.date));
    const totalImpressions = s.points.reduce((v, p) => v + p.impressions, 0);
    if (totalImpressions < MIN_IMPRESSIONS_WINDOW) continue;

    const clicksSeries = s.points.map((p) => p.clicks);
    const posSeries = s.points.map((p) => p.position);
    const clicksSlope = slopeOf(clicksSeries); // per day
    const posSlope = slopeOf(posSeries); // per day, positive = worsening

    // Daily → weekly delta
    const weeklyClicksDelta = clicksSlope * 7;
    const weeklyPosDelta = posSlope * 7;

    // Pick the worse signal: clicks dropping OR position worsening by ≥ 0.5/week.
    const clicksDeclining = weeklyClicksDelta < -0.5;
    const posDeclining = weeklyPosDelta > 0.5;

    if (!clicksDeclining && !posDeclining) continue;

    const totalClicks = s.points.reduce((v, p) => v + p.clicks, 0);
    const avgPosition =
      s.points.reduce((v, p) => v + p.position, 0) / s.points.length;

    // Severity: combine click-velocity loss + position worsening × volume.
    const volumeWeight = Math.log10(totalImpressions + 10);
    const severityScore =
      Math.abs(Math.min(weeklyClicksDelta, 0)) * volumeWeight +
      Math.max(weeklyPosDelta, 0) * volumeWeight * 0.5;

    let severity: RefreshCandidate["severity"] = "low";
    if (severityScore >= 4) severity = "high";
    else if (severityScore >= 2) severity = "medium";

    const weeklyDelta = clicksDeclining ? weeklyClicksDelta : -weeklyPosDelta;

    out.push({
      kind: "page",
      id: s.url,
      label: s.url,
      severity,
      weeklyDelta,
      totalWindowDays: s.points.length,
      totals: {
        clicks: totalClicks,
        impressions: totalImpressions,
        avgPosition: Number(avgPosition.toFixed(1)),
      },
      firstDate: s.points[0].date,
      lastDate: s.points[s.points.length - 1].date,
    });
  }

  // High severity first, then by impressions.
  const rank = { high: 3, medium: 2, low: 1 };
  out.sort(
    (a, b) =>
      rank[b.severity] - rank[a.severity] || b.totals.impressions - a.totals.impressions,
  );
  return out;
}

export function detectKeywordRefreshCandidates(
  series: KeywordSeries[],
): RefreshCandidate[] {
  const out: RefreshCandidate[] = [];

  for (const s of series) {
    if (s.points.length < MIN_POINTS) continue;
    s.points.sort((a, b) => a.date.localeCompare(b.date));

    const posSeries = s.points.map((p) => p.position);
    const posSlope = slopeOf(posSeries);
    const weeklyPosDelta = posSlope * 7;
    if (weeklyPosDelta <= 0.3) continue; // not declining

    const totalClicks = s.points.reduce((v, p) => v + p.clicks, 0);
    const avgPosition =
      s.points.reduce((v, p) => v + p.position, 0) / s.points.length;

    const volumeWeight = Math.log10(totalClicks + 10);
    const severityScore = weeklyPosDelta * volumeWeight;
    let severity: RefreshCandidate["severity"] = "low";
    if (severityScore >= 4) severity = "high";
    else if (severityScore >= 2) severity = "medium";

    out.push({
      kind: "keyword",
      id: s.keywordId,
      label: s.keyword,
      severity,
      weeklyDelta: -weeklyPosDelta, // negative = worsening, mirrors pages
      totalWindowDays: s.points.length,
      totals: {
        clicks: totalClicks,
        impressions: 0,
        avgPosition: Number(avgPosition.toFixed(1)),
      },
      firstDate: s.points[0].date,
      lastDate: s.points[s.points.length - 1].date,
    });
  }

  const rank = { high: 3, medium: 2, low: 1 };
  out.sort(
    (a, b) => rank[b.severity] - rank[a.severity] || b.totals.clicks - a.totals.clicks,
  );
  return out;
}
