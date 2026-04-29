import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { AlertCircle, ArrowRight, Target, ListOrdered, MousePointerClick, Activity, TrendingDown, MousePointer, FileX, EyeOff } from "lucide-react";
import { FetchNowButton } from "@/components/fetch-now-button";
import { FetchStatusBanner } from "@/components/fetch-status-banner";
import { BriefStatusBanner } from "@/components/brief-status-banner";
import { GscStatusBanner } from "@/components/gsc-status-banner";
import { SyncGscButton } from "@/components/sync-gsc-button";
import { RankDelta } from "@/components/rank-delta";
import { computeDiagnostic } from "@/lib/diagnostics";
import { type IssueCardData } from "@/components/issue-card";
import { SetupChecklist } from "@/components/setup-checklist";
import { GscPerformanceChart, HealthScoreChart } from "@/components/dashboard-charts";

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

export default async function DashboardHome() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);

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

  const setupComplete =
    connected && sites.length > 0 && activeKeywords.length > 0 && totalPositions > 0;

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

  // Score history for health chart
  const scoreHistory = seoScoreRows.slice().reverse().map((s) => ({
    date: s.computedAt.toISOString().slice(0, 10),
    score: s.score,
  }));

  // SEO health score from latest computation
  const latestScore = seoScoreRows[0] ?? null;
  const prevScore = seoScoreRows[1] ?? null;
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
      title: `Fix CTR on ${shortUrl(ctrTop.url)}`,
      subtitle: `~${recoverable.toLocaleString()} clicks/mo recoverable · pos ${ctrTop.avgPosition.toFixed(1)}`,
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
      title: `Lost: "${lostTop.keyword}"`,
      subtitle: `${lostTop.impressions28d.toLocaleString()} impressions in 28d, none in last 7d`,
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
      title: `Declining: ${shortUrl(decTop.url)}`,
      subtitle: `${decTop.delta} clicks vs prior 7d`,
      href: "/dashboard/pages",
      iconKey: "decline",
      tone: "down",
    });
  }

  const strikeTop = strikingDistance[0];
  if (strikeTop) {
    actionList.push({
      key: "strike",
      priority: 50,
      title: `Push "${strikeTop.keyword}" to page 1`,
      subtitle: `Currently #${strikeTop.latest} — top of page 2`,
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
      title: `Zero clicks: "${zeroTop.keyword}"`,
      subtitle: `${zeroTop.impressions.toLocaleString()} impressions, 0 clicks · title or intent mismatch`,
      href: `/dashboard/keywords?q=${encodeURIComponent(zeroTop.keyword)}`,
      iconKey: "filex",
      tone: "warn",
    });
  }

  const topActions = actionList.sort((a, b) => b.priority - a.priority).slice(0, 3);

  return (
    <div className="py-5 px-4 md:py-7 md:px-9 max-w-[1400px] mx-auto space-y-3">
      {/* Header */}
      <header className="flex items-end justify-between gap-6 flex-wrap mb-4">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {ctx.sessionUserEmail}
          </p>
          <h1 className="text-[36px] font-semibold leading-tight">Overview</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {connected && (
            <SyncGscButton
              days={90}
              label="Pull GSC"
              activeStatus={(latestGscRun?.status as any) ?? null}
            />
          )}
          <FetchNowButton activeStatus={(latestRun?.status as any) ?? null} />
        </div>
      </header>

      {/* Status banners */}
      <FetchStatusBanner run={runForBanner} />
      <BriefStatusBanner run={briefRunForBanner} />
      <GscStatusBanner run={gscRunForBanner} />

      {/* Today's actions — top 3 prioritized items across issues + insights */}
      {topActions.length > 0 && (
        <section className="bg-card rounded-2xl p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] text-muted-foreground">today's actions</span>
              <h2 className="text-lg font-semibold mt-0.5">
                {topActions.length === 1 ? "1 thing to focus on" : `${topActions.length} things to focus on`}
              </h2>
            </div>
            {issueCount > topActions.length && (
              <span className="font-mono text-[10px] text-muted-foreground">
                +{issueCount - topActions.length} more
              </span>
            )}
          </div>
          <div className="space-y-1">
            {topActions.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-colors"
              >
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${actionToneBg(a.tone)}`}>
                  {actionIcon(a.iconKey)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.subtitle}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bento Row 1: Hero KPI + Mini KPI Stack */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        {/* Hero KPI tile — SEO Health Score */}
        <div className="flex-1 min-h-[200px] bg-card rounded-2xl p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <span className="font-mono text-[11px] text-muted-foreground">seo health</span>
            </div>
            {healthDelta !== null && healthDelta !== 0 && (
              <span
                className={`font-mono text-[11px] font-medium rounded-full px-2.5 py-1 ${
                  healthDelta > 0
                    ? "bg-[var(--up)]/15 text-[var(--up)]"
                    : "bg-[var(--down)]/15 text-[var(--down)]"
                }`}
              >
                {healthDelta > 0 ? "+" : ""}{healthDelta} pts
              </span>
            )}
          </div>
          <div>
            <div
              className="font-mono text-[64px] font-semibold leading-[0.85] tabular-nums"
              style={{
                color: healthScore === null
                  ? undefined
                  : healthScore >= 70
                    ? "#34D399"
                    : healthScore >= 40
                      ? "#FBBF24"
                      : "#F87171",
              }}
            >
              {healthScore ?? "—"}
            </div>
            <div className="font-mono text-sm text-muted-foreground mt-2">
              {issueCount > 0
                ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} detected`
                : healthScore !== null
                  ? "no issues detected"
                  : "waiting for first score computation"}
            </div>
            {scoreHistory.length >= 2 && (
              <div className="mt-3 h-[60px]">
                <HealthScoreChart data={scoreHistory} />
              </div>
            )}
          </div>
        </div>

        {/* Mini KPI Stack */}
        <div className="w-full md:w-[280px] flex flex-col gap-3">
          <StatTile
            label="avg position"
            value={avgPosition ?? "—"}
            icon={<Target className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
          <StatTile
            label="clicks (28d)"
            value={clicks28d.toLocaleString()}
            icon={<MousePointerClick className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
          <StatTile
            label="keywords"
            value={activeKeywords.length.toLocaleString()}
            icon={<ListOrdered className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
        </div>
      </div>

      {/* Bento Row 2: Chart + Gap Zone */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Chart tile */}
        <div className="flex-1 min-h-[240px] md:h-[280px] bg-card rounded-2xl p-6 flex flex-col overflow-hidden">
          <div className="mb-3">
            <span className="font-mono text-[10px] text-muted-foreground">performance</span>
            <h2 className="text-xl font-semibold">Search Console</h2>
          </div>
          <div className="flex-1 min-h-0">
            {connected ? (
              <GscPerformanceChart trackedData={gscChartData} siteData={gscSiteChartData} compact />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Connect GSC to see performance data
              </div>
            )}
          </div>
        </div>

        {/* Gap Zone tile */}
        <div className="w-full md:w-[400px] min-h-[240px] md:h-[280px] bg-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
              <span className="font-mono text-[10px] text-muted-foreground">gap zone</span>
            </div>
            <h2 className="text-lg font-semibold">Highest ROI</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {gapZone.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">keyword</th>
                    <th className="text-right px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal">pos</th>
                    <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">7d</th>
                  </tr>
                </thead>
                <tbody>
                  {gapZone.map((g) => {
                    const delta7d =
                      g.weekAgo != null && g.latest != null ? g.weekAgo - g.latest : null;
                    return (
                      <tr key={g.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-xs truncate max-w-[200px]" title={g.keyword}>
                          {g.keyword}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{g.latest}</td>
                        <td className="px-4 py-2 text-right">
                          <RankDelta value={delta7d} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground px-6">
                Keywords in positions 5-20 will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup checklist — dismissible, with progress bar */}
      {!setupComplete && (
        <SetupChecklist
          steps={[
            { label: "Connect Google Search Console", done: connected },
            { label: "Add keywords", done: activeKeywords.length > 0 },
            { label: "First SERP fetch", done: totalPositions > 0 },
            { label: "First audit", done: hasAuditRun },
            { label: "First brief", done: latestBrief.length > 0 },
          ]}
        />
      )}

      {/* Bento Row 3: AI Brief + Distribution */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* AI Brief tile — white card, dark text */}
        {latestBrief.length > 0 ? (
          <Link
            href="/dashboard/brief"
            className="flex-1 h-[180px] rounded-2xl bg-white p-6 flex flex-col justify-between hover:opacity-95 transition-opacity"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] text-[#71717A]">
                latest ai brief · {latestBrief[0].periodStart} → {latestBrief[0].periodEnd}
              </span>
              <ArrowRight className="h-4 w-4 text-[#0A0A0A] shrink-0" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-[#0A0A0A] leading-relaxed line-clamp-3">
              {latestBrief[0].summary}
            </p>
          </Link>
        ) : (
          <div className="flex-1 h-[180px] rounded-2xl bg-card p-6 flex flex-col justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">ai brief</span>
            <p className="text-sm text-muted-foreground">
              Generate your first brief to see a preview here.
            </p>
          </div>
        )}

        {/* Distribution tile */}
        <div className="w-full md:w-[300px] h-[180px] bg-card rounded-2xl p-5 flex flex-col gap-3.5">
          <span className="font-mono text-[10px] text-muted-foreground">position distribution</span>

          {/* Bar */}
          {ranked.length > 0 ? (
            <>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-background">
                {[
                  { v: buckets.top3, bg: "#34D399" },
                  { v: buckets.top10, bg: "#34D39988" },
                  { v: buckets.top20, bg: "#A855F7" },
                  { v: buckets.top50, bg: "#A855F766" },
                  { v: buckets.rest, bg: "#71717A55" },
                ].map((b, i) =>
                  b.v > 0 ? (
                    <div
                      key={i}
                      style={{
                        width: `${(b.v / perKeyword.length) * 100}%`,
                        backgroundColor: b.bg,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="flex justify-between">
                <Bucket label="1-3" value={buckets.top3} color="#34D399" />
                <Bucket label="4-10" value={buckets.top10} color="#34D399" />
                <Bucket label="11-20" value={buckets.top20} color="#FFFFFF" />
                <Bucket label="21-50" value={buckets.top50} color="#A1A1AA" />
                <Bucket label="51+" value={buckets.rest + buckets.unranked} color="#71717A" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              No position data yet
            </div>
          )}

          {/* Upcoming schedule */}
          <div className="space-y-2 mt-auto">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-[#A1A1AA]">SERP fetch</span>
              <span className="flex-1 border-b border-border" />
              <span className="font-mono font-medium">{formatUntil(nextDailyFetch())}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="text-[#A1A1AA]">AI brief</span>
              <span className="flex-1 border-b border-border" />
              <span className="font-mono font-medium">{formatUntil(nextMondayBrief())}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function Bucket({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 bg-card rounded-2xl px-5 py-4 flex items-center justify-between">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
        <div className="font-mono text-[28px] font-semibold leading-tight tabular-nums">{value}</div>
      </div>
      {icon}
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

function actionIcon(key: "alert" | "ctr" | "lost" | "decline" | "target" | "filex") {
  const cls = "h-4 w-4";
  switch (key) {
    case "alert": return <AlertCircle className={`${cls} text-[#F87171]`} strokeWidth={1.5} />;
    case "ctr": return <MousePointer className={`${cls} text-[#FBBF24]`} strokeWidth={1.5} />;
    case "lost": return <EyeOff className={`${cls} text-[#F87171]`} strokeWidth={1.5} />;
    case "decline": return <TrendingDown className={`${cls} text-[#F87171]`} strokeWidth={1.5} />;
    case "target": return <Target className={`${cls} text-primary`} strokeWidth={1.5} />;
    case "filex": return <FileX className={`${cls} text-[#FBBF24]`} strokeWidth={1.5} />;
  }
}

function actionToneBg(tone: "default" | "warn" | "down") {
  switch (tone) {
    case "down": return "bg-[#F87171]/10";
    case "warn": return "bg-[#FBBF24]/10";
    default: return "bg-background";
  }
}
