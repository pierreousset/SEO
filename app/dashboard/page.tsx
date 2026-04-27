import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle, Clock, ArrowRight, Target, ListOrdered, MousePointerClick, Eye } from "lucide-react";
import { FetchNowButton } from "@/components/fetch-now-button";
import { FetchStatusBanner } from "@/components/fetch-status-banner";
import { BriefStatusBanner } from "@/components/brief-status-banner";
import { GscStatusBanner } from "@/components/gsc-status-banner";
import { GscPerformanceChart } from "@/components/gsc-performance-chart";
import { GenerateBriefButton } from "@/components/generate-brief-button";
import { SyncGscButton } from "@/components/sync-gsc-button";
import { RankDelta } from "@/components/rank-delta";
import { DiagnosticBadge } from "@/components/diagnostic-badge";
import { IntentStageBadge } from "@/components/intent-stage-badge";
import { computeDiagnostic, diagnosticInfo } from "@/lib/diagnostics";

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
    ]);

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
    const history = allPositions
      .filter((p) => p.keywordId === k.id)
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
  const twentyEightDaysAgo = new Date();
  twentyEightDaysAgo.setUTCDate(twentyEightDaysAgo.getUTCDate() - 28);
  const cutoff28d = twentyEightDaysAgo.toISOString().slice(0, 10);
  const recent28d = gscChartData.filter((d) => d.date >= cutoff28d);
  const clicks28d = recent28d.reduce((s, d) => s + d.clicks, 0);
  const impressions28d = recent28d.reduce((s, d) => s + d.impressions, 0);

  // Average position delta (compare last 7d avg vs prior 7d avg)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);
  const cutoff7d = sevenDaysAgo.toISOString().slice(0, 10);
  const cutoff14d = fourteenDaysAgo.toISOString().slice(0, 10);
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
    <div className="py-7 px-9 max-w-[1400px] mx-auto space-y-3">
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

      {/* Bento Row 1: Hero KPI + Mini KPI Stack */}
      <div className="flex gap-3 items-stretch">
        {/* Hero KPI tile */}
        <div className="flex-1 min-h-[200px] bg-card rounded-2xl p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">avg position</span>
            {avgPosDelta !== null && parseFloat(avgPosDelta) !== 0 && (
              <span
                className={`font-mono text-[11px] font-medium rounded-full px-2.5 py-1 ${
                  parseFloat(avgPosDelta) > 0
                    ? "bg-[var(--up)]/15 text-[var(--up)]"
                    : "bg-[var(--down)]/15 text-[var(--down)]"
                }`}
              >
                {parseFloat(avgPosDelta) > 0 ? "↑" : "↓"} {Math.abs(parseFloat(avgPosDelta))}
              </span>
            )}
          </div>
          <div>
            <div className="font-mono text-[64px] font-semibold leading-[0.85] tabular-nums">
              {avgPosition ?? "—"}
            </div>
            <div className="font-mono text-sm text-muted-foreground mt-2">
              across {ranked.length} ranked keyword{ranked.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Mini KPI Stack */}
        <div className="w-[280px] flex flex-col gap-3">
          <StatTile
            label="keywords"
            value={activeKeywords.length.toLocaleString()}
            icon={<ListOrdered className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
          <StatTile
            label="clicks (28d)"
            value={clicks28d.toLocaleString()}
            icon={<MousePointerClick className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
          <StatTile
            label="impressions"
            value={impressions28d.toLocaleString()}
            icon={<Eye className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
          />
        </div>
      </div>

      {/* Bento Row 2: Chart + Gap Zone */}
      <div className="flex gap-3">
        {/* Chart tile */}
        <div className="flex-1 h-[280px] bg-card rounded-2xl p-6 flex flex-col overflow-hidden">
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
        <div className="w-[400px] h-[280px] bg-card rounded-2xl overflow-hidden flex flex-col">
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
                    <th className="text-left px-4 py-2 font-mono text-[9px] text-muted-foreground font-medium">keyword</th>
                    <th className="text-right px-3 py-2 font-mono text-[9px] text-muted-foreground font-medium">pos</th>
                    <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-medium">7d</th>
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

      {/* Setup pipeline — only when incomplete */}
      {!setupComplete && (
        <div className="rounded-2xl bg-card overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Setup</h2>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {steps.filter((s) => s.done).length}/{steps.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                What&apos;s actually happening.
              </p>
            </div>
          </div>
          <ul className="px-2 pb-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 px-4 py-3 rounded-2xl hover:bg-background/60"
              >
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--up)]" strokeWidth={2} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 break-words">
                    {step.hint}
                  </div>
                </div>
                {step.action && "kind" in step.action ? (
                  <div className="shrink-0">
                    {step.action.kind === "fetch-now" ? (
                      <FetchNowButton activeStatus={(latestRun?.status as any) ?? null} />
                    ) : (
                      <GenerateBriefButton
                        activeStatus={(latestBriefRun?.status as any) ?? null}
                      />
                    )}
                  </div>
                ) : step.action ? (
                  <Link
                    href={step.action.href}
                    className="shrink-0 text-xs font-medium hover:underline"
                  >
                    {step.action.label} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bento Row 3: AI Brief + Distribution */}
      <div className="flex gap-3">
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
        <div className="w-[300px] h-[180px] bg-card rounded-2xl p-5 flex flex-col gap-3.5">
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
      {ranked.length > 0 && topUp.length === 0 && topDown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          Movers will appear after a second fetch. Daily cron runs at 06:00 UTC.
        </div>
      )}

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
          <div className="rounded-2xl bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-medium">status</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-medium">source</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-medium">queued</th>
                  <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-medium">duration</th>
                  <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-medium">result</th>
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
