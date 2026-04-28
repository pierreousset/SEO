import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle, Clock, ArrowRight, Target, ListOrdered, MousePointerClick, Eye, Activity, TrendingDown, MousePointer, Tag, FileX, ArrowDownRight, EyeOff } from "lucide-react";
import { FetchNowButton } from "@/components/fetch-now-button";
import { FetchStatusBanner } from "@/components/fetch-status-banner";
import { BriefStatusBanner } from "@/components/brief-status-banner";
import { GscStatusBanner } from "@/components/gsc-status-banner";
import { GenerateBriefButton } from "@/components/generate-brief-button";
import { SyncGscButton } from "@/components/sync-gsc-button";
import { RankDelta } from "@/components/rank-delta";
import { DiagnosticBadge } from "@/components/diagnostic-badge";
import { IntentStageBadge } from "@/components/intent-stage-badge";
import { computeDiagnostic, diagnosticInfo } from "@/lib/diagnostics";
import { IssueCard, type IssueCardData } from "@/components/issue-card";
import { SetupChecklist } from "@/components/setup-checklist";
import {
  GscPerformanceChart,
  CtrPositionScatter,
  HealthScoreChart,
} from "@/components/dashboard-charts";

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
    competitorData,
    kwMetrics,
    pageAgg28d,
    pageDelta14d,
    kwAgg7d,
    businessProfile,
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
      // Competitor positions — latest 30 rows, joined with keyword name
      db
        .select({
          domain: schema.competitorPositions.competitorDomain,
          keyword: schema.keywords.query,
          competitorPos: schema.competitorPositions.position,
          keywordId: schema.competitorPositions.keywordId,
        })
        .from(schema.competitorPositions)
        .innerJoin(schema.keywords, eq(schema.competitorPositions.keywordId, schema.keywords.id))
        .where(eq(schema.competitorPositions.userId, ctx.ownerId))
        .orderBy(desc(schema.competitorPositions.date))
        .limit(30),
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
      // Business profile — for branded keyword detection
      t.selectBusinessProfile(),
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

  // Top movers (need at least 2 fetches per keyword)
  const moversWithDelta = perKeyword
    .filter((s) => s.latest !== null && s.prev !== null)
    .map((s) => ({ ...s, delta: (s.prev as number) - (s.latest as number) }))
    .filter((s) => s.delta !== 0);
  const topUp = [...moversWithDelta].filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
  const topDown = [...moversWithDelta].filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

  const canFetchFirst = connected && activeKeywords.length > 0 && totalPositions === 0;
  const canGenerateBrief = totalPositions > 0;
  const setupComplete =
    connected && sites.length > 0 && activeKeywords.length > 0 && totalPositions > 0;

  // 28-day GSC aggregate for mini KPI cards
  const recent28d = gscChartData.filter((d) => d.date >= cutoff28d);
  const clicks28d = recent28d.reduce((s, d) => s + d.clicks, 0);
  const impressions28d = recent28d.reduce((s, d) => s + d.impressions, 0);
  const recentPositions = ranked.filter((s) => s.latest !== null).map((s) => s.latest!);
  const prevPositions = ranked.filter((s) => s.prev !== null).map((s) => s.prev!);
  const avgPrev = prevPositions.length > 0
    ? prevPositions.reduce((s, p) => s + p, 0) / prevPositions.length
    : null;
  const avgCurrent = recentPositions.length > 0
    ? recentPositions.reduce((s, p) => s + p, 0) / recentPositions.length
    : null;
  const avgPosDelta = avgPrev !== null && avgCurrent !== null
    ? (avgPrev - avgCurrent).toFixed(1)
    : null;

  // kwMetrics already fetched in the main Promise.all above
  const kwMetricsMap = new Map(kwMetrics.map((m) => [m.keywordId, m]));

  const scatterData = perKeyword
    .filter((s) => s.latest != null)
    .map((s) => {
      const m = kwMetricsMap.get(s.id);
      return {
        keyword: s.keyword,
        position: s.latest!,
        ctr: m && m.impressions > 0 ? m.clicks / m.impressions : 0,
        impressions: m?.impressions ?? 0,
      };
    })
    .filter((d) => d.impressions > 10);

  // ── Insights widgets (Vague 1) ──────────────────────────────────────
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

  // 2) Branded vs non-branded — split clicks/impressions on businessName match.
  const brandTokens = (() => {
    const name = businessProfile?.businessName?.trim().toLowerCase() ?? "";
    if (!name) return [] as string[];
    return name.split(/[\s,.\-_]+/).filter((t) => t.length >= 3);
  })();
  type BrandSplit = { clicks: number; impressions: number; count: number };
  const brandSplit = { branded: { clicks: 0, impressions: 0, count: 0 } as BrandSplit, nonBranded: { clicks: 0, impressions: 0, count: 0 } as BrandSplit };
  for (const k of activeKeywords) {
    const m = kwMetricsMap.get(k.id);
    if (!m) continue;
    const isBranded = brandTokens.length > 0 && brandTokens.some((t) => k.query.toLowerCase().includes(t));
    const bucket = isBranded ? brandSplit.branded : brandSplit.nonBranded;
    bucket.clicks += m.clicks;
    bucket.impressions += m.impressions;
    bucket.count += 1;
  }
  const brandTotalClicks = brandSplit.branded.clicks + brandSplit.nonBranded.clicks;

  // 3) CTR underperformers — pages in top 10 with CTR < expected × 0.5.
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
  const topIssues = healthIssues.slice(0, 3);

  // Pipeline state: each step is done/pending/blocked.
  // `action` can be a Link (href + label) or a "fetch-now" sentinel for the inline button.
  type Step = {
    label: string;
    done: boolean;
    hint: string;
    action?:
      | { href: string; label: string }
      | { kind: "fetch-now" }
      | { kind: "brief-now" }
      | null;
  };

  const steps: Step[] = [
    {
      label: "Sign in",
      done: true,
      hint: ctx.sessionUserEmail,
    },
    {
      label: "Connect Google Search Console",
      done: connected,
      hint: connected
        ? `connected ${formatRelative(gscToken[0].connectedAt)}`
        : "required to read your positions",
      action: !connected ? { href: "/dashboard/connect-google", label: "Connect" } : null,
    },
    {
      label: "Register a site",
      done: sites.length > 0,
      hint: sites[0]?.domain ?? "auto-created when you connect GSC",
    },
    {
      label: "Track keywords",
      done: activeKeywords.length > 0,
      hint:
        activeKeywords.length > 0
          ? `${activeKeywords.length} tracked`
          : "auto-imported from GSC top 20",
      action:
        activeKeywords.length === 0 && sites.length > 0
          ? { href: "/dashboard/keywords", label: "Add manually" }
          : null,
    },
    {
      label: "First SERP fetch",
      done: totalPositions > 0,
      hint:
        lastFetch != null
          ? `last fetched ${formatRelative(lastFetch)} · ${ranked.length}/${perKeyword.length} ranked in top 100`
          : canFetchFirst
            ? `daily cron at 06:00 UTC. Run it now ⤵`
            : `next scheduled run ${formatUntil(nextDailyFetch())}`,
      action: canFetchFirst ? { kind: "fetch-now" as const } : null,
    },
    {
      label: "Weekly AI brief",
      done: latestBrief.length > 0,
      hint: latestBrief.length > 0
        ? `last brief: week of ${latestBrief[0].periodStart}`
        : canGenerateBrief
          ? `you have data — generate the first brief now ⤵`
          : `first brief ${formatUntil(nextMondayBrief())} (needs ≥1 SERP fetch first)`,
      action:
        latestBrief.length === 0 && canGenerateBrief ? { kind: "brief-now" as const } : null,
    },
  ];

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

      {/* Top Issues — shown when score has issues */}
      {topIssues.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#F87171]" strokeWidth={1.5} />
            <span className="font-mono text-[11px] text-muted-foreground">
              top issues
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topIssues.map((issue) => (
              <IssueCard key={issue.type} issue={issue} />
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

      {/* Top movers */}
      {(topUp.length > 0 || topDown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MoverList title="Top up" items={topUp} direction="up" />
          <MoverList title="Top down" items={topDown} direction="down" />
        </div>
      )}

      {/* Insights — 6 quick-look widgets */}
      {(strikingDistance.length > 0 ||
        brandTotalClicks > 0 ||
        ctrUnderperformers.length > 0 ||
        lostQueries.length > 0 ||
        decliningPages.length > 0 ||
        zeroClickQueries.length > 0) && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-mono text-[11px] text-muted-foreground">insights</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Striking distance */}
            <InsightCard
              title="Striking distance"
              hint="Pos 11-20 — easy wins"
              icon={<Target className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />}
              count={strikingDistance.length}
              empty="No keywords in pos 11-20"
              href="/dashboard/keywords"
            >
              {strikingDistance.map((s) => (
                <InsightRow
                  key={s.id}
                  primary={s.keyword}
                  secondary={`#${s.latest}`}
                />
              ))}
            </InsightCard>

            {/* Branded vs non-branded */}
            <BrandedSplitCard
              brandName={businessProfile?.businessName ?? null}
              brandTokens={brandTokens}
              branded={brandSplit.branded}
              nonBranded={brandSplit.nonBranded}
            />

            {/* CTR underperformers (pages) */}
            <InsightCard
              title="CTR underperformers"
              hint="Pages in top 10, CTR < expected"
              icon={<MousePointer className="h-3.5 w-3.5 text-[#FBBF24]" strokeWidth={1.5} />}
              count={ctrUnderperformers.length}
              empty="No CTR underperformers"
              href="/dashboard/pages"
            >
              {ctrUnderperformers.map((p) => (
                <InsightRow
                  key={p.url}
                  primary={shortUrl(p.url)}
                  secondary={`${(p.actual * 100).toFixed(1)}% / ${(p.expected * 100).toFixed(0)}%`}
                  tone="warn"
                />
              ))}
            </InsightCard>

            {/* Lost queries */}
            <InsightCard
              title="Lost queries"
              hint="Had impressions, none in 7d"
              icon={<EyeOff className="h-3.5 w-3.5 text-[#F87171]" strokeWidth={1.5} />}
              count={lostQueries.length}
              empty="No lost queries"
              href="/dashboard/keywords"
            >
              {lostQueries.map((q) => (
                <InsightRow
                  key={q.keyword}
                  primary={q.keyword}
                  secondary={`${q.impressions28d.toLocaleString()} imp 28d`}
                  tone="down"
                />
              ))}
            </InsightCard>

            {/* Declining pages */}
            <InsightCard
              title="Declining pages"
              hint="Biggest click drop (7d vs prior 7d)"
              icon={<TrendingDown className="h-3.5 w-3.5 text-[#F87171]" strokeWidth={1.5} />}
              count={decliningPages.length}
              empty="No declining pages"
              href="/dashboard/pages"
            >
              {decliningPages.map((p) => (
                <InsightRow
                  key={p.url}
                  primary={shortUrl(p.url)}
                  secondary={`${p.delta > 0 ? "+" : ""}${p.delta} clicks`}
                  tone="down"
                />
              ))}
            </InsightCard>

            {/* Zero-click queries */}
            <InsightCard
              title="Zero-click queries"
              hint=">100 imp 28d, 0 clicks"
              icon={<FileX className="h-3.5 w-3.5 text-[#FBBF24]" strokeWidth={1.5} />}
              count={zeroClickQueries.length}
              empty="No zero-click queries"
              href="/dashboard/keywords"
            >
              {zeroClickQueries.map((q) => (
                <InsightRow
                  key={q.keyword}
                  primary={q.keyword}
                  secondary={`${q.impressions.toLocaleString()} imp`}
                  tone="warn"
                />
              ))}
            </InsightCard>
          </div>
        </section>
      )}
      {ranked.length > 0 && topUp.length === 0 && topDown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          Movers will appear after a second fetch. Daily cron runs at 06:00 UTC.
        </div>
      )}

      {/* CTR vs Position scatter plot */}
      {scatterData.length > 5 && (
        <div className="bg-card rounded-2xl p-6">
          <span className="font-mono text-[10px] text-muted-foreground">analysis</span>
          <h2 className="text-xl font-semibold mt-0.5 mb-4">CTR vs Position</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Keywords below the benchmark line have poor titles or mismatched intent.
          </p>
          <div className="h-[300px]">
            <CtrPositionScatter data={scatterData} />
          </div>
        </div>
      )}

      {/* Competitor positions */}
      {competitorData.length > 0 && (() => {
        // Deduplicate: group by keywordId, keep the competitor with the best (lowest) position
        const bestByKeyword = new Map<string, { domain: string; keyword: string; competitorPos: number | null; keywordId: string }>();
        for (const row of competitorData) {
          const existing = bestByKeyword.get(row.keywordId);
          if (!existing || (row.competitorPos !== null && (existing.competitorPos === null || row.competitorPos < existing.competitorPos))) {
            bestByKeyword.set(row.keywordId, row);
          }
        }
        const rows = Array.from(bestByKeyword.values());

        return (
          <div className="bg-card rounded-2xl p-6">
            <span className="font-mono text-[10px] text-muted-foreground">competitors</span>
            <h2 className="text-xl font-semibold mt-0.5 mb-4">Competitor positions</h2>
            <div className="rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">keyword</th>
                    <th className="text-right px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal">you</th>
                    <th className="text-left px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal">competitor</th>
                    <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">them</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const snap = perKeyword.find((s) => s.id === row.keywordId);
                    const yourPos = snap?.latest ?? null;
                    const theirPos = row.competitorPos;
                    const competitorAhead = theirPos !== null && yourPos !== null && theirPos < yourPos;
                    const youAhead = theirPos !== null && yourPos !== null && yourPos < theirPos;

                    return (
                      <tr key={row.keywordId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-xs truncate max-w-[200px]" title={row.keyword}>
                          {row.keyword}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {yourPos ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs truncate max-w-[160px]" title={row.domain}>
                          {row.domain}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums ${competitorAhead ? "text-[var(--down)]" : youAhead ? "text-[var(--up)]" : ""}`}>
                          {theirPos ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Inngest dev hint */}
      {connected && activeKeywords.length > 0 && totalPositions === 0 && (
        <div className="rounded-2xl border border-border p-4 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <strong className="text-foreground">No positions yet.</strong> Daily cron runs at
            06:00 UTC. In dev, start{" "}
            <code className="font-mono tabular-nums text-foreground">
              bunx inngest-cli@latest dev
            </code>
            , then tap <strong>Fetch now</strong>.
          </div>
        </div>
      )}

      {/* Recent fetch runs */}
      {recentRuns.length > 0 && (
        <section>
          <span className="font-mono text-[10px] text-muted-foreground">activity</span>
          <h2 className="text-xl font-semibold mt-0.5 mb-3">Recent fetches</h2>
          <div className="rounded-2xl bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">status</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">source</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">queued</th>
                  <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">duration</th>
                  <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">result</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => {
                  const dur =
                    r.startedAt && r.finishedAt
                      ? Math.round(
                          (r.finishedAt.getTime() - r.startedAt.getTime()) / 1000,
                        )
                      : null;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <RunStatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono tabular-nums">
                        {r.source}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono tabular-nums">
                        {formatRelative(r.queuedAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs font-mono tabular-nums">
                        {dur != null ? `${dur}s` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                        {r.resultCount != null && r.taskCount != null
                          ? `${r.resultCount}/${r.taskCount}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function gapZoneRationale(s: {
  latest: number | null;
  intentStage: number | null;
}): string {
  const pos = s.latest ?? 0;
  const stage = s.intentStage;

  if (pos <= 7 && stage === 4) {
    return "Top of page 2 + commercial intent. Title polish + 1 internal link → page 1 in 30d.";
  }
  if (pos <= 7) {
    return "Top of page 2. Tighten title, add internal links from your strongest pages.";
  }
  if (pos <= 12 && stage === 4) {
    return "Bottom of page 2 + commercial intent. Worth a content refresh + better meta.";
  }
  if (pos <= 12) {
    return "Bottom of page 2. Refresh content with deeper structure + intent-matched headings.";
  }
  if (stage === 4) {
    return "Page 2 ceiling + commercial intent. Needs a dedicated page or major refresh.";
  }
  return "Page 2. Add a section addressing this query directly + internal links.";
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

function MoverList({
  title,
  items,
  direction,
}: {
  title: string;
  items: Array<{ keyword: string; latest: number | null; delta: number }>;
  direction: "up" | "down";
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl bg-card p-5">
      <h3 className="font-mono text-[10px] text-muted-foreground mb-4">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-background/60 text-sm"
          >
            <div className="flex-1 truncate" title={item.keyword}>
              {item.keyword}
            </div>
            <div className="font-mono tabular-nums text-muted-foreground text-xs shrink-0">
              #{item.latest}
            </div>
            <div className="shrink-0 w-12 text-right">
              <RankDelta value={item.delta} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    queued: { label: "queued", cls: "bg-foreground/10 text-foreground" },
    running: { label: "running", cls: "bg-foreground/10 text-foreground" },
    done: { label: "done", cls: "bg-[var(--up)]/15 text-[var(--up)]" },
    failed: { label: "failed", cls: "bg-[var(--down)]/15 text-[var(--down)]" },
    skipped: { label: "skipped", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span
      className={`inline-block text-[10px] uppercase font-medium px-2.5 py-1 rounded-full ${v.cls}`}
    >
      {v.label}
    </span>
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

function InsightCard({
  title,
  hint,
  icon,
  count,
  empty,
  href,
  children,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <div className="rounded-2xl bg-card p-5 h-full flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="font-mono text-[10px] text-muted-foreground">{title.toLowerCase()}</span>
          </div>
          <h3 className="text-sm font-semibold mt-1">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
        {count > 0 && (
          <span className="font-mono text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-background text-muted-foreground shrink-0">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {count === 0 ? (
          <div className="text-[11px] text-muted-foreground py-2">{empty}</div>
        ) : (
          <div className="space-y-1">{children}</div>
        )}
      </div>
      {href && count > 0 && (
        <div className="flex items-center justify-end text-[10px] text-muted-foreground gap-1 pt-1 border-t border-border">
          <span>view all</span>
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-95 transition-opacity">{body}</Link> : body;
}

function InsightRow({
  primary,
  secondary,
  tone,
}: {
  primary: string;
  secondary: string;
  tone?: "warn" | "down";
}) {
  const toneClass = tone === "down"
    ? "text-[var(--down)]"
    : tone === "warn"
      ? "text-[#FBBF24]"
      : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 truncate" title={primary}>{primary}</div>
      <div className={`font-mono tabular-nums text-[11px] shrink-0 ${toneClass}`}>{secondary}</div>
    </div>
  );
}

function BrandedSplitCard({
  brandName,
  brandTokens,
  branded,
  nonBranded,
}: {
  brandName: string | null;
  brandTokens: string[];
  branded: { clicks: number; impressions: number; count: number };
  nonBranded: { clicks: number; impressions: number; count: number };
}) {
  const total = branded.clicks + nonBranded.clicks;
  const brandedPct = total > 0 ? Math.round((branded.clicks / total) * 100) : 0;
  const noBrand = !brandName || brandTokens.length === 0;

  return (
    <div className="rounded-2xl bg-card p-5 flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
          <span className="font-mono text-[10px] text-muted-foreground">branded share</span>
        </div>
        <h3 className="text-sm font-semibold mt-1">Branded vs non-branded</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {noBrand
            ? "Set your brand name in Business profile"
            : `Detected: "${brandName}"`}
        </p>
      </div>
      {noBrand ? (
        <Link
          href="/dashboard/business"
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          Set brand name <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      ) : total === 0 ? (
        <div className="text-[11px] text-muted-foreground">No GSC data yet</div>
      ) : (
        <div className="space-y-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-background">
            <div style={{ width: `${brandedPct}%`, backgroundColor: "#A855F7" }} />
            <div style={{ width: `${100 - brandedPct}%`, backgroundColor: "#34D399" }} />
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <div>
              <div className="font-mono tabular-nums text-base font-semibold" style={{ color: "#A855F7" }}>
                {brandedPct}%
              </div>
              <div className="text-muted-foreground">branded · {branded.clicks.toLocaleString()} clicks</div>
            </div>
            <div className="text-right">
              <div className="font-mono tabular-nums text-base font-semibold" style={{ color: "#34D399" }}>
                {100 - brandedPct}%
              </div>
              <div className="text-muted-foreground">non-branded · {nonBranded.clicks.toLocaleString()} clicks</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  icon,
  label,
  value,
  when,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  when: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-background flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{when}</div>
      </div>
      <div className="text-sm font-mono tabular-nums shrink-0">{value}</div>
    </div>
  );
}
