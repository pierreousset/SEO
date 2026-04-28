/**
 * SEO Coach scoring engine — pure algorithmic, no LLM.
 *
 * Computes a 0-100 health score and detects actionable issues
 * from GSC data, SERP positions, audit findings, and crawl data.
 */

// ── Types ────────────────────────────────────────────────────────

export type PageData = {
  url: string;
  clicks28d: number;
  impressions28d: number;
  avgPosition: number;
  clicksPrev28d: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  inSitemap: boolean;
  indexable: boolean;
};

export type KeywordData = {
  id: string;
  query: string;
  latestPosition: number | null;
  previousPosition: number | null;
  weekAgoPosition: number | null;
  impressions28d: number;
  clicks28d: number;
  intentStage: number | null;
};

export type SiteData = {
  pages: PageData[];
  keywords: KeywordData[];
  auditFindings?: { severity: string; category: string }[];
  sitemapUrls?: number;
  crawledPages?: number;
};

export type IssueType =
  | "declining_traffic"
  | "low_ctr_for_position"
  | "zero_clicks"
  | "quick_win"
  | "title_missing"
  | "title_short"
  | "title_long"
  | "meta_missing"
  | "meta_short"
  | "h1_missing"
  | "not_in_sitemap"
  | "noindex"
  | "keyword_dropping"
  | "keyword_opportunity"
  | "keyword_low_ctr";

export type Issue = {
  type: IssueType;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  whyItMatters?: string;
  affectedPages?: string[];
  affectedKeywords?: string[];
};

export type ScoreBreakdown = {
  titleQuality: number;
  metaQuality: number;
  positionTrend: number;
  sitemapCoverage: number;
  ctrHealth: number;
  indexCoverage: number;
  h1Presence: number;
  auditHealth: number;
  availableFactors: number;
};

// ── CTR Benchmarks ───────────────────────────────────────────────

const CTR_BENCHMARK: Record<number, number> = {
  1: 0.28,
  2: 0.15,
  3: 0.11,
  4: 0.06,
  5: 0.06,
  6: 0.03,
  7: 0.03,
  8: 0.03,
  9: 0.03,
  10: 0.03,
};

function expectedCtr(position: number): number {
  if (position <= 0) return 0;
  if (position <= 10) return CTR_BENCHMARK[Math.round(position)] ?? 0.03;
  if (position <= 20) return 0.01;
  return 0.003;
}

// ── Global Health Score ──────────────────────────────────────────

const WEIGHTS = {
  titleQuality: 15,
  metaQuality: 15,
  positionTrend: 20,
  sitemapCoverage: 10,
  ctrHealth: 10,
  indexCoverage: 10,
  h1Presence: 5,
  auditHealth: 15,
};

export function computeGlobalScore(data: SiteData): { score: number; breakdown: ScoreBreakdown } {
  const scores: Record<string, number | null> = {};

  // Title quality: % of pages with title 30-60 chars
  if (data.pages.length > 0) {
    const good = data.pages.filter(
      (p) => p.titleLength >= 30 && p.titleLength <= 60,
    ).length;
    scores.titleQuality = (good / data.pages.length) * 100;
  } else {
    scores.titleQuality = null;
  }

  // Meta description quality: % of pages with meta 120-160 chars
  if (data.pages.length > 0) {
    const good = data.pages.filter(
      (p) => p.metaDescriptionLength >= 120 && p.metaDescriptionLength <= 160,
    ).length;
    scores.metaQuality = (good / data.pages.length) * 100;
  } else {
    scores.metaQuality = null;
  }

  // Position trend: avg improvement over 7 days
  if (data.keywords.length > 0) {
    const withData = data.keywords.filter(
      (k) => k.latestPosition != null && k.weekAgoPosition != null,
    );
    if (withData.length > 0) {
      const avgDelta =
        withData.reduce(
          (s, k) => s + ((k.weekAgoPosition ?? 0) - (k.latestPosition ?? 0)),
          0,
        ) / withData.length;
      // Clamp to [-20, +20], map to 0-100
      const clamped = Math.max(-20, Math.min(20, avgDelta));
      scores.positionTrend = ((clamped + 20) / 40) * 100;
    } else {
      scores.positionTrend = 50; // neutral if no delta data
    }
  } else {
    scores.positionTrend = null;
  }

  // Sitemap coverage
  if (data.sitemapUrls != null && data.crawledPages != null && data.crawledPages > 0) {
    const coverage = Math.min(1, data.sitemapUrls / data.crawledPages);
    scores.sitemapCoverage = coverage * 100;
  } else {
    scores.sitemapCoverage = null;
  }

  // CTR health: avg (actual_ctr / expected_ctr) across keywords
  if (data.keywords.length > 0) {
    const withPos = data.keywords.filter(
      (k) => k.latestPosition != null && k.impressions28d > 0,
    );
    if (withPos.length > 0) {
      const ratios = withPos.map((k) => {
        const actualCtr = k.clicks28d / k.impressions28d;
        const expected = expectedCtr(k.latestPosition ?? 100);
        return expected > 0 ? Math.min(2, actualCtr / expected) : 1;
      });
      const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
      scores.ctrHealth = Math.min(100, avg * 50); // 1.0 ratio → 50, 2.0+ → 100
    } else {
      scores.ctrHealth = null;
    }
  } else {
    scores.ctrHealth = null;
  }

  // Index coverage: pages with impressions / total pages
  if (data.pages.length > 0) {
    const indexed = data.pages.filter((p) => p.impressions28d > 0).length;
    scores.indexCoverage = (indexed / data.pages.length) * 100;
  } else {
    scores.indexCoverage = null;
  }

  // H1 presence
  if (data.pages.length > 0) {
    const withH1 = data.pages.filter((p) => p.h1 != null && p.h1.length > 0).length;
    scores.h1Presence = (withH1 / data.pages.length) * 100;
  } else {
    scores.h1Presence = null;
  }

  // Audit health: 1 - (high_severity / total)
  if (data.auditFindings && data.auditFindings.length > 0) {
    const high = data.auditFindings.filter((f) => f.severity === "high").length;
    scores.auditHealth = Math.max(0, (1 - high / data.auditFindings.length) * 100);
  } else {
    scores.auditHealth = null;
  }

  // Weighted average with redistribution of unavailable factors
  let totalWeight = 0;
  let weightedSum = 0;
  let availableFactors = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const val = scores[key];
    if (val != null) {
      totalWeight += weight;
      weightedSum += val * weight;
      availableFactors++;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return {
    score,
    breakdown: {
      titleQuality: Math.round(scores.titleQuality ?? 0),
      metaQuality: Math.round(scores.metaQuality ?? 0),
      positionTrend: Math.round(scores.positionTrend ?? 50),
      sitemapCoverage: Math.round(scores.sitemapCoverage ?? 0),
      ctrHealth: Math.round(scores.ctrHealth ?? 0),
      indexCoverage: Math.round(scores.indexCoverage ?? 0),
      h1Presence: Math.round(scores.h1Presence ?? 0),
      auditHealth: Math.round(scores.auditHealth ?? 0),
      availableFactors,
    },
  };
}

// ── Page Issues Detection ────────────────────────────────────────

export function detectPageIssues(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];

  // Declining traffic: pages losing >30% clicks in 14d
  const declining = pages.filter(
    (p) => p.clicksPrev28d > 5 && p.clicks28d < p.clicksPrev28d * 0.7,
  );
  if (declining.length > 0) {
    issues.push({
      type: "declining_traffic",
      severity: "high",
      title: `${declining.length} page${declining.length > 1 ? "s" : ""} losing traffic`,
      description: `These pages lost more than 30% of their clicks compared to the previous period.`,
      impact: `~${declining.reduce((s, p) => s + (p.clicksPrev28d - p.clicks28d), 0)} clicks lost`,
      whyItMatters:
        "A sudden traffic drop usually means a competitor published better content, Google changed how it interprets the query, or your page's freshness signal decayed. Check what changed.",
      affectedPages: declining.map((p) => p.url),
    });
  }

  // Low CTR for position: rank well but CTR is way below benchmark
  const lowCtr = pages.filter((p) => {
    if (p.impressions28d < 50 || p.avgPosition > 20) return false;
    const actual = p.clicks28d / p.impressions28d;
    const expected = expectedCtr(p.avgPosition);
    return actual < expected * 0.5; // less than half the expected CTR
  });
  if (lowCtr.length > 0) {
    issues.push({
      type: "low_ctr_for_position",
      severity: "medium",
      title: `${lowCtr.length} page${lowCtr.length > 1 ? "s" : ""} with low click-through rate`,
      description: `These pages rank well but get fewer clicks than expected. Usually means the title or meta description doesn't match what users are looking for.`,
      impact: `Improving titles could add ~${Math.round(lowCtr.reduce((s, p) => {
        const expected = expectedCtr(p.avgPosition) * p.impressions28d;
        return s + Math.max(0, expected - p.clicks28d);
      }, 0))} clicks/month`,
      whyItMatters:
        "Your page appears in search results but users skip it. The title tag is the #1 factor for click-through rate. A good title matches the searcher's intent and includes the keyword naturally.",
      affectedPages: lowCtr.map((p) => p.url),
    });
  }

  // Zero-click pages: indexed but 0 clicks in 28d
  const zeroClicks = pages.filter(
    (p) => p.impressions28d > 20 && p.clicks28d === 0,
  );
  if (zeroClicks.length > 0) {
    issues.push({
      type: "zero_clicks",
      severity: "low",
      title: `${zeroClicks.length} page${zeroClicks.length > 1 ? "s" : ""} with zero clicks`,
      description: `These pages show in search results but nobody clicks them.`,
      impact: `Potential to recover ${zeroClicks.reduce((s, p) => s + Math.round(p.impressions28d * 0.01), 0)} clicks/month with better titles`,
      whyItMatters:
        "A page that gets impressions but zero clicks is wasting its position. Either the title doesn't match the intent, or the page targets queries nobody actually wants to click on.",
      affectedPages: zeroClicks.map((p) => p.url),
    });
  }

  // Quick wins: position 11-20 with high impressions
  const quickWins = pages.filter(
    (p) => p.avgPosition >= 11 && p.avgPosition <= 20 && p.impressions28d > 100,
  );
  if (quickWins.length > 0) {
    issues.push({
      type: "quick_win",
      severity: "medium",
      title: `${quickWins.length} page${quickWins.length > 1 ? "s" : ""} close to page 1`,
      description: `These pages rank on page 2 with significant search volume. A small improvement could push them to page 1.`,
      impact: `Moving to page 1 typically increases clicks by 5-10x`,
      whyItMatters:
        "Page 2 of Google gets less than 1% of clicks. Page 1 gets 90%+. The difference between position 11 and position 10 is enormous. Focus your content improvement efforts here first.",
      affectedPages: quickWins.map((p) => p.url),
    });
  }

  // Title issues
  const noTitle = pages.filter((p) => !p.title);
  if (noTitle.length > 0) {
    issues.push({
      type: "title_missing",
      severity: "high",
      title: `${noTitle.length} page${noTitle.length > 1 ? "s" : ""} missing title`,
      description: `Pages without a title tag rank poorly and get almost no clicks.`,
      impact: `Adding titles is the highest-impact SEO fix`,
      whyItMatters: "The title tag is the first thing Google and users see. Without it, Google generates one from your page content, which is almost always worse.",
      affectedPages: noTitle.map((p) => p.url),
    });
  }

  const shortTitle = pages.filter((p) => p.title && p.titleLength < 30);
  if (shortTitle.length > 0) {
    issues.push({
      type: "title_short",
      severity: "medium",
      title: `${shortTitle.length} page${shortTitle.length > 1 ? "s" : ""} with short titles`,
      description: `Titles under 30 characters miss keyword opportunities. Aim for 30-60 characters.`,
      impact: `Better titles = higher CTR`,
      affectedPages: shortTitle.map((p) => p.url),
    });
  }

  // Meta issues
  const noMeta = pages.filter((p) => !p.metaDescription);
  if (noMeta.length > 0) {
    issues.push({
      type: "meta_missing",
      severity: "medium",
      title: `${noMeta.length} page${noMeta.length > 1 ? "s" : ""} missing meta description`,
      description: `Google shows the meta description in search results. Without one, it grabs random text from your page.`,
      impact: `Good meta descriptions improve CTR by 5-10%`,
      whyItMatters: "The meta description is your ad copy in search results. It doesn't directly affect ranking, but it affects whether people click. Write it like a call to action.",
      affectedPages: noMeta.map((p) => p.url),
    });
  }

  // Not in sitemap
  const notInSitemap = pages.filter((p) => !p.inSitemap && p.indexable);
  if (notInSitemap.length > 0) {
    issues.push({
      type: "not_in_sitemap",
      severity: "low",
      title: `${notInSitemap.length} page${notInSitemap.length > 1 ? "s" : ""} not in sitemap`,
      description: `These pages are indexed but not listed in your sitemap.xml.`,
      impact: `Adding them helps Google discover and re-crawl them faster`,
      affectedPages: notInSitemap.map((p) => p.url),
    });
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

// ── Keyword Issues Detection ─────��───────────────────────────────

export function detectKeywordIssues(keywords: KeywordData[]): Issue[] {
  const issues: Issue[] = [];

  // Dropping keywords
  const dropping = keywords.filter(
    (k) =>
      k.latestPosition != null &&
      k.weekAgoPosition != null &&
      k.latestPosition - k.weekAgoPosition >= 5,
  );
  if (dropping.length > 0) {
    issues.push({
      type: "keyword_dropping",
      severity: "high",
      title: `${dropping.length} keyword${dropping.length > 1 ? "s" : ""} dropping fast`,
      description: `These keywords lost 5+ positions in the last 7 days.`,
      impact: `Each lost position on page 1 costs ~30% of clicks`,
      whyItMatters: "A sudden position drop usually means a competitor published better content or Google re-evaluated your page. Check the SERP for these queries and see what changed.",
      affectedKeywords: dropping.map((k) => k.query),
    });
  }

  // Opportunity keywords (position 4-10, could be top 3)
  const opportunities = keywords.filter(
    (k) =>
      k.latestPosition != null &&
      k.latestPosition >= 4 &&
      k.latestPosition <= 10 &&
      k.impressions28d > 50,
  );
  if (opportunities.length > 0) {
    issues.push({
      type: "keyword_opportunity",
      severity: "medium",
      title: `${opportunities.length} keyword${opportunities.length > 1 ? "s" : ""} close to top 3`,
      description: `These keywords are on page 1 but not in the top 3, where most clicks go.`,
      impact: `Top 3 gets 54% of all clicks vs 12% for positions 4-10`,
      whyItMatters: "Positions 1-3 get dramatically more clicks than 4-10. Improving your content depth, internal linking, and title for these queries can push you into the high-click zone.",
      affectedKeywords: opportunities.map((k) => k.query),
    });
  }

  // Low CTR keywords
  const lowCtrKw = keywords.filter((k) => {
    if (k.latestPosition == null || k.impressions28d < 30) return false;
    const actual = k.clicks28d / k.impressions28d;
    const expected = expectedCtr(k.latestPosition);
    return actual < expected * 0.4;
  });
  if (lowCtrKw.length > 0) {
    issues.push({
      type: "keyword_low_ctr",
      severity: "medium",
      title: `${lowCtrKw.length} keyword${lowCtrKw.length > 1 ? "s" : ""} with low CTR`,
      description: `These keywords rank decently but get fewer clicks than expected for their position.`,
      impact: `Improving titles + meta descriptions for these could double their clicks`,
      whyItMatters: "When your CTR is below average for your position, it tells Google your result isn't what searchers want. This can lead to further ranking drops. Fix the title to match the search intent.",
      affectedKeywords: lowCtrKw.map((k) => k.query),
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

// ── Per-Keyword Tip (algorithmic, no LLM) ────────────────────────

export type KeywordTip = {
  text: string;
  color: "green" | "yellow" | "red" | "purple" | "gray";
};

export function getKeywordTip(k: KeywordData): KeywordTip {
  if (k.latestPosition == null) {
    return { text: "No ranking data yet.", color: "gray" };
  }

  const delta7d =
    k.weekAgoPosition != null ? k.weekAgoPosition - k.latestPosition : null;

  // Quick win
  if (k.latestPosition >= 11 && k.latestPosition <= 20 && k.impressions28d > 100) {
    return {
      text: "Quick win: push to page 1 with title optimization.",
      color: "purple",
    };
  }

  // Low CTR for good rank
  if (k.latestPosition <= 10 && k.impressions28d > 30) {
    const actual = k.clicks28d / k.impressions28d;
    const expected = expectedCtr(k.latestPosition);
    if (actual < expected * 0.5) {
      return {
        text: "Good rank but low CTR. Improve your title + meta.",
        color: "yellow",
      };
    }
  }

  // Significant drop
  if (delta7d != null && delta7d <= -5) {
    return {
      text: `Significant drop (${Math.abs(delta7d)} positions). Review content freshness.`,
      color: "red",
    };
  }

  // Moderate drop
  if (delta7d != null && delta7d <= -3) {
    return {
      text: `Lost ${Math.abs(delta7d)} positions. Check competitors.`,
      color: "yellow",
    };
  }

  // Gained
  if (delta7d != null && delta7d >= 3) {
    return {
      text: `Gained ${delta7d} positions. Keep it up.`,
      color: "green",
    };
  }

  // Stable
  return { text: "Position stable.", color: "green" };
}
