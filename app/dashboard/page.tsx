import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { FetchNowButton } from "@/components/fetch-now-button";
import { FetchStatusBanner } from "@/components/fetch-status-banner";
import { BriefStatusBanner } from "@/components/brief-status-banner";
import { GscStatusBanner } from "@/components/gsc-status-banner";
import { SyncGscButton } from "@/components/sync-gsc-button";
import { computeDiagnostic } from "@/lib/diagnostics";
import { type IssueCardData } from "@/components/issue-card";
import { GscPerformanceChart, HealthScoreChart } from "@/components/dashboard-charts";
import { OnboardingSetup } from "@/components/onboarding-setup";
import { DashboardFlashToasts, type FlashToast } from "@/components/dashboard-flash-toasts";
import { getAuthUrl } from "@/lib/google-oauth";
import { adsDeveloperTokenConfigured, getAdsAuthUrl } from "@/lib/google-ads";
import { selectAdsOpportunities } from "@/lib/ads-opportunities";
import { randomBytes } from "node:crypto";
import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";

export const dynamic = "force-dynamic";

function nextDailyFetch(): string {
  // Cron is "0 6 * * *" UTC. Compute the next 06:00 UTC from now.
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function nextMondayBrief(): string {
  // Cron "0 9 * * 1" — Monday 09:00 UTC.
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  // 1 = Monday, 0 = Sunday in JS
  const day = next.getUTCDay();
  let daysUntilMonday = (1 - day + 7) % 7;
  if (daysUntilMonday === 0 && next <= now) daysUntilMonday = 7;
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return next.toISOString();
}

function formatRelative(iso: string | Date | null): string {
  if (!iso) return "never";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
  return `${Math.round(diffMin / (60 * 24))}d ago`;
}

function formatUntil(iso: string): string {
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)}h`;
  return `in ${Math.round(diffMin / (60 * 24))}d`;
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; gsc?: string; ads?: string; ads_warn?: string }>;
}) {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const lng = await getLocale();
  const i = locale[lng];
  const sp = await searchParams;

  const [gscEarly] = await t.selectGscToken();
  const keywordsEarly = await t.selectKeywords();
  const gscConnected = Boolean(gscEarly);
  if (!gscConnected || keywordsEarly.length === 0) {
    const authUrl = process.env.GOOGLE_CLIENT_ID
      ? getAuthUrl(randomBytes(16).toString("hex"))
      : null;
    const onboardFlashes: FlashToast[] = [];
    if (sp.connected === "1" && !sp.gsc) {
      onboardFlashes.push({ type: "success", message: i.onboarding.justConnected });
    }
    if (sp.gsc === "no_property") {
      onboardFlashes.push({ type: "error", message: i.onboarding.warnNoProperty });
    }
    if (sp.gsc === "no_queries") {
      onboardFlashes.push({ type: "warning", message: i.onboarding.warnNoQueries });
    }
    if (sp.gsc === "import_failed") {
      onboardFlashes.push({ type: "error", message: i.onboarding.warnImportFailed });
    }
    return (
      <div className="py-5 px-4 md:py-7 md:px-9 max-w-[1400px] mx-auto">
        <DashboardFlashToasts flashes={onboardFlashes} />
        <OnboardingSetup
          i={i}
          connected={gscConnected}
          keywordCount={keywordsEarly.length}
          authUrl={authUrl}
          isOwner={ctx.isOwner}
        />
      </div>
    );
  }

  // 30-day window for distribution + delta computation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  // Shorter windows used by Insights widgets (declining pages, lost queries…)
  const cutoff28d = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 28);
    return d.toISOString().slice(0, 10);
  })();
  const cutoff7d = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const cutoff14d = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 14);
    return d.toISOString().slice(0, 10);
  })();

  const [
    gscToken,
    sites,
    keywords,
    allPositions,
    latestBrief,
    recentRuns,
    recentBriefRuns,
    recentGscRuns,
    rawGscMetrics,
    rawGscSiteMetrics,
    seoScoreRows,
    auditRunRows,
    kwMetrics,
    pageAgg28d,
    pageDelta14d,
    kwAgg7d,
    adsTokenRows,
    adsTermRows,
  ] = await Promise.all([
      t.selectGscToken(),
      t.selectSites(),
      t.selectKeywords(),
      db
        .select()
        .from(schema.positions)
        .where(
          and(
            eq(schema.positions.userId, ctx.ownerId),
            gte(schema.positions.date, cutoff),
          ),
        )
        .orderBy(desc(schema.positions.date)),
      t.selectLatestBrief(),
      db
        .select()
        .from(schema.fetchRuns)
        .where(eq(schema.fetchRuns.userId, ctx.ownerId))
        .orderBy(desc(schema.fetchRuns.queuedAt))
        .limit(5),
      db
        .select()
        .from(schema.briefRuns)
        .where(eq(schema.briefRuns.userId, ctx.ownerId))
        .orderBy(desc(schema.briefRuns.queuedAt))
        .limit(1),
      db
        .select()
        .from(schema.gscRuns)
        .where(eq(schema.gscRuns.userId, ctx.ownerId))
        .orderBy(desc(schema.gscRuns.queuedAt))
        .limit(1),
      db
        .select({
          date: schema.gscMetrics.date,
          clicks: schema.gscMetrics.clicks,
          impressions: schema.gscMetrics.impressions,
          ctr: schema.gscMetrics.ctr,
          position: schema.gscMetrics.gscPosition,
        })
        .from(schema.gscMetrics)
        .where(eq(schema.gscMetrics.userId, ctx.ownerId)),
      db
        .select()
        .from(schema.gscSiteMetrics)
        .where(eq(schema.gscSiteMetrics.userId, ctx.ownerId)),
      db
        .select()
        .from(schema.seoScores)
        .where(eq(schema.seoScores.userId, ctx.ownerId))
        .orderBy(desc(schema.seoScores.computedAt))
        .limit(8),
      // Audit run check (for setup checklist)
      db
        .select({ id: schema.auditRuns.id })
        .from(schema.auditRuns)
        .where(eq(schema.auditRuns.userId, ctx.ownerId))
        .limit(1),
      // Per-keyword GSC metrics for CTR scatter plot (was a separate query below)
      db
        .select({
          keywordId: schema.gscMetrics.keywordId,
          clicks: sql<number>`sum(${schema.gscMetrics.clicks})::int`,
          impressions: sql<number>`sum(${schema.gscMetrics.impressions})::int`,
        })
        .from(schema.gscMetrics)
        .where(and(eq(schema.gscMetrics.userId, ctx.ownerId), gte(schema.gscMetrics.date, cutoff)))
        .groupBy(schema.gscMetrics.keywordId),
      // Page-level aggregate over 28d — for CTR underperformers + as base for declining
      db
        .select({
          url: schema.gscPageMetrics.url,
          clicks: sql<number>`sum(${schema.gscPageMetrics.clicks})::int`,
          impressions: sql<number>`sum(${schema.gscPageMetrics.impressions})::int`,
          avgPosition: sql<number>`avg(${schema.gscPageMetrics.position}::numeric)::float`,
        })
        .from(schema.gscPageMetrics)
        .where(and(eq(schema.gscPageMetrics.userId, ctx.ownerId), gte(schema.gscPageMetrics.date, cutoff28d)))
        .groupBy(schema.gscPageMetrics.url)
        .orderBy(desc(sql`sum(${schema.gscPageMetrics.impressions})`))
        .limit(200),
      // Page-level last-7d vs prior-7d delta — for declining widget
      db
        .select({
          url: schema.gscPageMetrics.url,
          clicksRecent: sql<number>`sum(case when ${schema.gscPageMetrics.date} >= ${cutoff7d} then ${schema.gscPageMetrics.clicks} else 0 end)::int`,
          clicksPrior: sql<number>`sum(case when ${schema.gscPageMetrics.date} < ${cutoff7d} then ${schema.gscPageMetrics.clicks} else 0 end)::int`,
        })
        .from(schema.gscPageMetrics)
        .where(and(eq(schema.gscPageMetrics.userId, ctx.ownerId), gte(schema.gscPageMetrics.date, cutoff14d)))
        .groupBy(schema.gscPageMetrics.url),
      // Per-keyword last-7d aggregate — for lost queries detection (had impressions, now zero)
      db
        .select({
          keywordId: schema.gscMetrics.keywordId,
          clicks: sql<number>`sum(${schema.gscMetrics.clicks})::int`,
          impressions: sql<number>`sum(${schema.gscMetrics.impressions})::int`,
        })
        .from(schema.gscMetrics)
        .where(and(eq(schema.gscMetrics.userId, ctx.ownerId), gte(schema.gscMetrics.date, cutoff7d)))
        .groupBy(schema.gscMetrics.keywordId),
      t.selectAdsToken(),
      t.selectAdsSearchTerms(),
    ]);

  const hasAuditRun = auditRunRows.length > 0;

  // Aggregate GSC metrics by date — sum clicks/impressions, weight CTR by impressions,
  // average position over keywords that ranked that day.
  type DailyAgg = { clicks: number; impressions: number; positions: number[] };
  const byDate = new Map<string, DailyAgg>();
  for (const m of rawGscMetrics) {
    const cur = byDate.get(m.date) ?? { clicks: 0, impressions: 0, positions: [] };
    cur.clicks += m.clicks;
    cur.impressions += m.impressions;
    const p = parseFloat(m.position) || 0;
    if (p > 0) cur.positions.push(p);
    byDate.set(m.date, cur);
  }
  const gscChartData = Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position:
        v.positions.length > 0
          ? v.positions.reduce((s, p) => s + p, 0) / v.positions.length
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const gscSiteChartData = rawGscSiteMetrics
    .map((r) => ({
      date: r.date,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat(r.ctr) || 0,
      position: parseFloat(r.position) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const latestGscRun = recentGscRuns[0] ?? null;
  const gscRunForBanner = latestGscRun
    ? {
        id: latestGscRun.id,
        status: latestGscRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestGscRun.queuedAt.toISOString(),
        startedAt: latestGscRun.startedAt?.toISOString() ?? null,
        finishedAt: latestGscRun.finishedAt?.toISOString() ?? null,
        daysRequested: latestGscRun.daysRequested,
        rowsFetched: latestGscRun.rowsFetched,
        metricsUpserted: latestGscRun.metricsUpserted,
        error: latestGscRun.error,
      }
    : null;

  const latestBriefRun = recentBriefRuns[0] ?? null;
  const briefRunForBanner = latestBriefRun
    ? {
        id: latestBriefRun.id,
        source: latestBriefRun.source,
        status: latestBriefRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestBriefRun.queuedAt.toISOString(),
        startedAt: latestBriefRun.startedAt?.toISOString() ?? null,
        finishedAt: latestBriefRun.finishedAt?.toISOString() ?? null,
        error: latestBriefRun.error,
      }
    : null;

  const latestRun = recentRuns[0] ?? null;
  const runForBanner = latestRun
    ? {
        id: latestRun.id,
        source: latestRun.source,
        status: latestRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestRun.queuedAt.toISOString(),
        startedAt: latestRun.startedAt?.toISOString() ?? null,
        finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        taskCount: latestRun.taskCount,
        resultCount: latestRun.resultCount,
        error: latestRun.error,
      }
    : null;

  const connected = gscToken.length > 0;
  const activeKeywords = keywords.filter((k) => !k.removedAt);
  const totalPositions = allPositions.length;
  const lastFetch = allPositions[0]?.fetchedAt ?? null;

  // Build a Map<keywordId, positions[]> so we avoid O(keywords × positions) filtering
  const positionsByKeyword = new Map<string, typeof allPositions>();
  for (const p of allPositions) {
    let arr = positionsByKeyword.get(p.keywordId);
    if (!arr) {
      arr = [];
      positionsByKeyword.set(p.keywordId, arr);
    }
    arr.push(p);
  }

  // Per-keyword latest + previous (for delta computation) + diagnostic tag
  type Snap = {
    id: string;
    keyword: string;
    intentStage: number | null;
    latest: number | null;
    prev: number | null;
    weekAgo: number | null;
    diagnostic: ReturnType<typeof computeDiagnostic>;
  };
  const perKeyword: Snap[] = activeKeywords.map((k) => {
    const history = (positionsByKeyword.get(k.id) ?? [])
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1)?.position ?? null;
    const prev = history.at(-2)?.position ?? null;
    const weekAgo = history.at(-8)?.position ?? null;
    const diagnostic = computeDiagnostic(
      history.map((p) => ({ date: p.date, position: p.position })),
    );
    return {
      id: k.id,
      keyword: k.query,
      intentStage: k.intentStage,
      latest,
      prev,
      weekAgo,
      diagnostic,
    };
  });

  // Gap Zone — keywords in position 5-20, the highest-ROI window.
  // Sorted: stage 4 (commercial intent) first, then by current position ascending (closer to top = easier).
  const gapZone = perKeyword
    .filter((s) => s.diagnostic === "gap_zone")
    .sort((a, b) => {
      const aStage = a.intentStage ?? 0;
      const bStage = b.intentStage ?? 0;
      if (aStage !== bStage) return bStage - aStage;
      return (a.latest ?? 999) - (b.latest ?? 999);
    })
    .slice(0, 8);

  const ranked = perKeyword.filter((s) => s.latest !== null);
  const avgPosition =
    ranked.length > 0
      ? (ranked.reduce((s, k) => s + (k.latest ?? 0), 0) / ranked.length).toFixed(1)
      : null;

  // Distribution buckets (based on latest position)
  const buckets = {
    top3: ranked.filter((s) => (s.latest ?? 999) <= 3).length,
    top10: ranked.filter((s) => (s.latest ?? 999) > 3 && (s.latest ?? 999) <= 10).length,
    top20: ranked.filter((s) => (s.latest ?? 999) > 10 && (s.latest ?? 999) <= 20).length,
    top50: ranked.filter((s) => (s.latest ?? 999) > 20 && (s.latest ?? 999) <= 50).length,
    rest: ranked.filter((s) => (s.latest ?? 999) > 50).length,
    unranked: perKeyword.length - ranked.length,
  };

  // 28-day GSC aggregate for mini KPI cards
  const recent28d = gscChartData.filter((d) => d.date >= cutoff28d);
  const clicks28d = recent28d.reduce((s, d) => s + d.clicks, 0);

  // kwMetrics already fetched in the main Promise.all above
  const kwMetricsMap = new Map(kwMetrics.map((m) => [m.keywordId, m]));

  // ── Today's actions data prep ──────────────────────────────────────
  // CTR benchmarks per position (matches lib/seo-score.ts).
  const expectedCtrFor = (pos: number): number => {
    if (pos <= 0) return 0;
    if (pos <= 1) return 0.28;
    if (pos <= 2) return 0.15;
    if (pos <= 3) return 0.11;
    if (pos <= 5) return 0.06;
    if (pos <= 10) return 0.03;
    if (pos <= 20) return 0.01;
    return 0.003;
  };

  // 1) Striking distance — keywords currently sitting in pos 11-20.
  const strikingDistance = perKeyword
    .filter((s) => s.latest != null && s.latest > 10 && s.latest <= 20)
    .sort((a, b) => (a.latest ?? 99) - (b.latest ?? 99))
    .slice(0, 6);

  // 2) CTR underperformers — pages in top 10 with CTR < expected × 0.5.
  const ctrUnderperformers = pageAgg28d
    .filter((p) => p.impressions > 50 && p.avgPosition > 0 && p.avgPosition <= 10)
    .map((p) => {
      const actual = p.impressions > 0 ? p.clicks / p.impressions : 0;
      const expected = expectedCtrFor(p.avgPosition);
      const ratio = expected > 0 ? actual / expected : 1;
      return { ...p, actual, expected, ratio };
    })
    .filter((p) => p.ratio < 0.5)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  // 4) Lost queries — had impressions in last 28d, zero in last 7d.
  const kwAgg7dMap = new Map(kwAgg7d.map((m) => [m.keywordId, m]));
  const keywordLookup = new Map(activeKeywords.map((k) => [k.id, k.query]));
  const lostQueries = kwMetrics
    .filter((m) => m.impressions > 20 && keywordLookup.has(m.keywordId))
    .map((m) => ({
      keyword: keywordLookup.get(m.keywordId)!,
      impressions28d: m.impressions,
      impressions7d: kwAgg7dMap.get(m.keywordId)?.impressions ?? 0,
    }))
    .filter((m) => m.impressions7d === 0)
    .sort((a, b) => b.impressions28d - a.impressions28d)
    .slice(0, 5);

  // 5) Top declining pages — biggest click drop vs prior 7d (min 5 prior clicks to filter noise).
  const decliningPages = pageDelta14d
    .map((p) => ({ ...p, delta: p.clicksRecent - p.clicksPrior }))
    .filter((p) => p.clicksPrior >= 5 && p.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  // 6) Zero-click queries — high impressions, zero clicks (broken title/meta or wrong intent).
  const zeroClickQueries = kwMetrics
    .filter((m) => m.impressions >= 100 && m.clicks === 0 && keywordLookup.has(m.keywordId))
    .map((m) => ({ keyword: keywordLookup.get(m.keywordId)!, impressions: m.impressions }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  let scoreRows = seoScoreRows;
  if (scoreRows.length === 0) {
    try {
      const { recomputeSeoScore } = await import("@/lib/seo-score-recompute");
      await recomputeSeoScore(ctx.ownerId);
      scoreRows = await db
        .select()
        .from(schema.seoScores)
        .where(eq(schema.seoScores.userId, ctx.ownerId))
        .orderBy(desc(schema.seoScores.computedAt))
        .limit(8);
    } catch (err) {
      console.warn("[dashboard] seo score recompute failed:", err);
    }
  }

  // Score history for health chart
  const scoreHistory = scoreRows.slice().reverse().map((s) => ({
    date: s.computedAt.toISOString().slice(0, 10),
    score: s.score,
  }));

  // SEO health score from latest computation
  const latestScore = scoreRows[0] ?? null;
  const prevScore = scoreRows[1] ?? null;
  const healthScore = latestScore?.score ?? null;
  const healthDelta = latestScore && prevScore ? latestScore.score - prevScore.score : null;
  const healthIssues = (latestScore?.issues ?? []) as IssueCardData[];
  const issueCount = healthIssues.length;

  // ── Today's actions — top 3 prioritized items across issues + insights ─────
  type Action = {
    key: string;
    priority: number;
    title: string;
    subtitle: string;
    href: string;
    iconKey: "alert" | "ctr" | "lost" | "decline" | "target" | "filex";
    tone: "default" | "warn" | "down";
  };
  const actionList: Action[] = [];

  // Route a health issue to the right page based on its type prefix.
  const issueHref = (type: string): string => {
    if (type.startsWith("keyword_")) return "/dashboard/keywords";
    if (type === "missing_business_profile") return "/dashboard/business";
    if (type === "no_audit") return "/dashboard/audit";
    return "/dashboard/pages";
  };

  for (const issue of healthIssues.slice(0, 3)) {
    const priority = issue.severity === "high" ? 110 : issue.severity === "medium" ? 90 : 75;
    actionList.push({
      key: `issue-${issue.type}`,
      priority,
      title: issue.title,
      subtitle: issue.impact,
      href: issueHref(issue.type),
      iconKey: "alert",
      tone: issue.severity === "high" ? "down" : "warn",
    });
  }

  const ctrTop = ctrUnderperformers[0];
  if (ctrTop) {
    const recoverable = Math.max(0, Math.round((ctrTop.expected - ctrTop.actual) * ctrTop.impressions));
    actionList.push({
      key: "ctr",
      priority: 80,
      title: i.actions.fixCtrOn(shortUrl(ctrTop.url)),
      subtitle: i.actions.fixCtrSubtitle(recoverable.toLocaleString(), ctrTop.avgPosition.toFixed(1)),
      href: "/dashboard/pages",
      iconKey: "ctr",
      tone: "warn",
    });
  }

  const lostTop = lostQueries[0];
  if (lostTop) {
    actionList.push({
      key: "lost",
      priority: 70,
      title: i.actions.lostQuery(lostTop.keyword),
      subtitle: i.actions.lostQuerySubtitle(lostTop.impressions28d.toLocaleString()),
      href: `/dashboard/keywords?q=${encodeURIComponent(lostTop.keyword)}`,
      iconKey: "lost",
      tone: "down",
    });
  }

  const decTop = decliningPages[0];
  if (decTop) {
    actionList.push({
      key: "dec",
      priority: 60,
      title: i.actions.decliningPage(shortUrl(decTop.url)),
      subtitle: i.actions.decliningSubtitle(decTop.delta),
      href: "/dashboard/pages",
      iconKey: "decline",
      tone: "down",
    });
  }

  const strikeTop = strikingDistance[0];
  if (strikeTop && strikeTop.latest != null) {
    actionList.push({
      key: "strike",
      priority: 50,
      title: i.actions.pushToPage1(strikeTop.keyword),
      subtitle: i.actions.pushSubtitle(strikeTop.latest),
      href: `/dashboard/keywords?q=${encodeURIComponent(strikeTop.keyword)}`,
      iconKey: "target",
      tone: "default",
    });
  }

  const zeroTop = zeroClickQueries[0];
  if (zeroTop) {
    actionList.push({
      key: "zero",
      priority: 40,
      title: i.actions.zeroClicks(zeroTop.keyword),
      subtitle: i.actions.zeroClicksSubtitle(zeroTop.impressions.toLocaleString()),
      href: `/dashboard/keywords?q=${encodeURIComponent(zeroTop.keyword)}`,
      iconKey: "filex",
      tone: "warn",
    });
  }

  const adsOpps = selectAdsOpportunities(
    adsTermRows.map((r) => ({
      query: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      costMicros: r.costMicros,
      conversions: r.conversions,
    })),
    perKeyword.map((s) => ({ query: s.keyword, position: s.latest })),
  );
  const eur = (n: number) =>
    n.toLocaleString(lng === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 });
  for (const opp of adsOpps) {
    if (opp.kind === "paid_overlap") {
      actionList.push({
        key: `ads-overlap-${opp.query}`,
        priority: 100,
        title: i.actions.paidOverlap(opp.query),
        subtitle: i.actions.paidOverlapSubtitle(eur(opp.costEur), opp.position),
        href: `/dashboard/keywords?q=${encodeURIComponent(opp.query)}`,
        iconKey: "alert",
        tone: "warn",
      });
    } else if (opp.kind === "paid_gap") {
      actionList.push({
        key: `ads-gap-${opp.query}`,
        priority: 88,
        title: i.actions.paidGap(opp.query),
        subtitle: i.actions.paidGapSubtitle(eur(opp.costEur)),
        href: `/dashboard/keywords?q=${encodeURIComponent(opp.query)}`,
        iconKey: "target",
        tone: "default",
      });
    } else {
      actionList.push({
        key: `ads-new-${opp.query}`,
        priority: 48,
        title: i.actions.adsNew(opp.query),
        subtitle: i.actions.adsNewSubtitle(opp.impressions.toLocaleString(), eur(opp.costEur)),
        href: `/dashboard/keywords?q=${encodeURIComponent(opp.query)}`,
        iconKey: "target",
        tone: "default",
      });
    }
  }

  const topActions = actionList.sort((a, b) => b.priority - a.priority).slice(0, 3);

  const flashes: FlashToast[] = [];
  if (sp.connected === "1") {
    flashes.push({ type: "success", message: i.onboarding.justConnected });
  }
  if (sp.ads === "1" && !sp.ads_warn) {
    flashes.push({ type: "success", message: i.onboarding.adsConnected });
  }
  if (sp.ads_warn === "no_account") {
    flashes.push({ type: "warning", message: i.onboarding.adsNoAccount });
  }
  if (sp.ads_warn === "token_test_only") {
    flashes.push({
      type: "warning",
      message: i.onboarding.adsTokenTest,
      action: "apicenter",
      actionLabel: "API Center",
    });
  }
  if (sp.ads_warn === "import_failed") {
    flashes.push({
      type: "error",
      message: i.onboarding.adsImportFailed,
      action: ctx.isOwner ? "retry-ads" : undefined,
      actionLabel: i.onboarding.adsRetry,
    });
  }

  return (
    <div className="px-5 sm:px-8 md:px-12 py-12 md:py-16 max-w-[1240px] mx-auto space-y-16">
      <DashboardFlashToasts flashes={flashes} />
      {gscConnected && adsTokenRows.length === 0 && (
        <div className="sheet flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <p className="text-body-sm text-deep-slate flex-1">{i.onboarding.adsHint}</p>
          {ctx.isOwner && adsDeveloperTokenConfigured() && process.env.GOOGLE_CLIENT_ID ? (
            <a
              href={getAdsAuthUrl(randomBytes(16).toString("hex"))}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-button-black text-canvas-white text-sm shadow-button shrink-0"
            >
              {i.onboarding.adsCta}
            </a>
          ) : (
            <p className="text-caption text-ash-gray">{i.onboarding.adsMissingToken}</p>
          )}
        </div>
      )}
      {gscChartData.length === 0 && (
        <div className="sheet flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          <p className="text-body-sm text-deep-slate flex-1">{i.onboarding.pullHint}</p>
          <SyncGscButton
            days={90}
            label={i.onboarding.pullCta}
            activeStatus={(latestGscRun?.status as "queued" | "running" | "done" | "failed" | "skipped" | null) ?? null}
          />
        </div>
      )}

      <header className="flex items-end justify-end gap-2 flex-wrap">
          {connected && (
            <SyncGscButton
              days={90}
              label={i.pullGsc}
              activeStatus={(latestGscRun?.status as "queued" | "running" | "done" | "failed" | "skipped" | null) ?? null}
            />
          )}
          <FetchNowButton
            activeStatus={(latestRun?.status as "queued" | "running" | "done" | "failed" | "skipped" | null) ?? null}
            label={i.fetchNow}
            runningLabel="Récupération…"
          />
      </header>

      <FetchStatusBanner run={runForBanner} />
      <BriefStatusBanner run={briefRunForBanner} />
      <GscStatusBanner run={gscRunForBanner} />

      <section className="sheet px-6 py-8 md:px-10 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5">
          <p className="font-caveat text-2xl text-ink-black leading-none">{i.headerKicker}</p>
          <p className="text-caption text-ash-gray mt-7">{i.bento.seoHealth}</p>
          <p className="mt-1 font-semibold tabular-nums text-ink-black leading-[0.86] tracking-[-0.05em] text-[clamp(4.5rem,10vw,7rem)]">
            {healthScore ?? "—"}
            {healthDelta !== null && healthDelta !== 0 && (
              <span
                className={`ml-3 align-top text-subheading font-medium tabular-nums ${
                  healthDelta > 0 ? "text-sky-teal" : "text-hot-pink"
                }`}
              >
                {healthDelta > 0 ? "+" : ""}
                {healthDelta}
              </span>
            )}
          </p>
          <p className="font-caveat text-[1.75rem] text-sky-teal mt-4 leading-tight max-w-[18rem]">
            {i.coachNote(topActions.length)}
          </p>
          {scoreHistory.length >= 2 && (
            <div className="mt-8 h-16 max-w-[280px]">
              <HealthScoreChart data={scoreHistory} />
            </div>
          )}
        </div>

        <ol className="lg:col-span-7 space-y-0">
          {topActions.length > 0 ? (
            topActions.map((a, idx) => (
              <li key={a.key} className="border-t border-hairline first:border-t-0">
                <Link
                  href={a.href}
                  className="group grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-5"
                >
                  <span className="text-subheading font-semibold tabular-nums text-ink-black leading-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="text-subheading font-semibold text-ink-black group-hover:text-sky-teal transition-colors duration-150 ease-out">
                      {a.title}
                    </span>
                    <span className="block text-caption text-ash-gray mt-2">{a.subtitle}</span>
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li className="border-t border-hairline pt-6">
              <p className="text-body text-ash-gray">{i.bento.aiBriefEmpty}</p>
            </li>
          )}
        </ol>
      </section>

      <section className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="sheet px-5 py-5">
          <p className="text-caption text-ash-gray">{i.bento.avgPosition}</p>
          <p className="text-heading font-semibold tabular-nums tracking-tight mt-2">{avgPosition ?? "—"}</p>
        </div>
        <div className="sheet px-5 py-5">
          <p className="text-caption text-ash-gray">{i.bento.clicks28d}</p>
          <p className="text-heading font-semibold tabular-nums tracking-tight mt-2">{clicks28d.toLocaleString()}</p>
        </div>
        <div className="sheet px-5 py-5">
          <p className="text-caption text-ash-gray">{i.bento.keywords}</p>
          <p className="text-heading font-semibold tabular-nums tracking-tight mt-2">
            {activeKeywords.length.toLocaleString()}
          </p>
        </div>
      </section>

      <section className="sheet px-6 py-6 md:px-8 md:py-8">
        <div className="h-[320px]">
          {connected ? (
            <GscPerformanceChart trackedData={gscChartData} siteData={gscSiteChartData} compact />
          ) : (
            <p className="text-body-sm text-ash-gray">{i.bento.connectGsc}</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
        <div className="sheet px-6 py-6 md:px-8 md:py-8 lg:col-span-7">
          <p className="text-caption text-ash-gray">{i.bento.aiBrief}</p>
          {latestBrief.length > 0 ? (
            <Link href="/dashboard/brief" className="block mt-3 group">
              <p className="font-caveat text-3xl md:text-4xl text-ink-black leading-snug">
                {latestBrief[0].summary}
              </p>
              <p className="text-caption text-ash-gray mt-4 group-hover:text-sky-teal transition-colors">
                {i.bento.latestBriefAt(latestBrief[0].periodStart, latestBrief[0].periodEnd)}
              </p>
            </Link>
          ) : (
            <p className="text-body text-ash-gray mt-3">{i.bento.aiBriefEmpty}</p>
          )}
        </div>

        <div className="sheet px-6 py-6 md:px-8 md:py-8 lg:col-span-5">
          <p className="text-caption text-ash-gray">{i.bento.highestRoi}</p>
          {gapZone.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {gapZone.slice(0, 6).map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3 last:border-0 last:pb-0">
                  <span className="text-body-sm text-ink-black truncate">{g.keyword}</span>
                  <span className="text-body-sm tabular-nums text-ash-gray shrink-0">{g.latest}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ash-gray mt-3">{i.bento.gapEmpty}</p>
          )}
        </div>
      </section>

      {ranked.length > 0 && (
        <section className="sheet px-6 py-6 md:px-8 md:py-8 flex flex-wrap gap-8 md:gap-12">
          <Bucket label="1–3" value={buckets.top3} />
          <Bucket label="4–10" value={buckets.top10} />
          <Bucket label="11–20" value={buckets.top20} />
          <Bucket label="21–50" value={buckets.top50} />
          <Bucket label="51+" value={buckets.rest + buckets.unranked} />
        </section>
      )}
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-heading font-semibold tabular-nums text-ink-black leading-none">
        {value}
      </div>
      <div className="text-caption text-ash-gray mt-2">{label}</div>
    </div>
  );
}

function shortUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const path = parsed.pathname === "/" ? "/" : parsed.pathname;
    return path.length > 36 ? `…${path.slice(-35)}` : path;
  } catch {
    return u.length > 36 ? `…${u.slice(-35)}` : u;
  }
}


