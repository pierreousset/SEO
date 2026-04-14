import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle, Clock, ArrowRight, Target } from "lucide-react";
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
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const t = tenantDb(session.user.id);

  // 30-day window for distribution + delta computation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const [gscToken, sites, keywords, allPositions, latestBrief, recentRuns, recentBriefRuns, recentGscRuns] =
    await Promise.all([
      t.selectGscToken(),
      t.selectSites(),
      t.selectKeywords(),
      db
        .select()
        .from(schema.positions)
        .where(
          and(
            eq(schema.positions.userId, session.user.id),
            gte(schema.positions.date, cutoff),
          ),
        )
        .orderBy(desc(schema.positions.date)),
      t.selectLatestBrief(),
      db
        .select()
        .from(schema.fetchRuns)
        .where(eq(schema.fetchRuns.userId, session.user.id))
        .orderBy(desc(schema.fetchRuns.queuedAt))
        .limit(5),
      db
        .select()
        .from(schema.briefRuns)
        .where(eq(schema.briefRuns.userId, session.user.id))
        .orderBy(desc(schema.briefRuns.queuedAt))
        .limit(1),
      db
        .select()
        .from(schema.gscRuns)
        .where(eq(schema.gscRuns.userId, session.user.id))
        .orderBy(desc(schema.gscRuns.queuedAt))
        .limit(1),
    ]);

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
      hint: session.user.email,
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
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {session.user.email}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Overview</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {connected && <SyncGscButton days={90} label="Pull GSC history" />}
          {canGenerateBrief && <GenerateBriefButton label={latestBrief.length > 0 ? "Regenerate brief" : "Generate brief"} />}
          <FetchNowButton />
        </div>
      </header>

      <FetchStatusBanner run={runForBanner} />
      <BriefStatusBanner run={briefRunForBanner} />
      <GscStatusBanner run={gscRunForBanner} />

      {/* Hero KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Keywords tracked" value={activeKeywords.length.toString()} />
        <StatTile
          label="Avg position (top 100)"
          value={avgPosition ?? "—"}
          muted={avgPosition === null}
        />
        <StatTile
          label="Last fetch"
          value={lastFetch ? formatRelative(lastFetch) : "never"}
          muted={!lastFetch}
        />
      </section>

      {/* Main grid: 2/3 primary column + 1/3 side column */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gap Zone — highest ROI */}
          {gapZone.length > 0 && (
            <div className="rounded-[20px] bg-secondary p-6 md:p-8">
              <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3 w-3" strokeWidth={1.5} />
                    Gap Zone
                  </div>
                  <h2 className="font-display text-2xl md:text-3xl mt-2">
                    Your highest ROI this week
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Keywords ranking 5-20 — page 1 within reach with one focused fix.
                  </p>
                </div>
                <Link
                  href="/dashboard/keywords"
                  className="text-sm font-medium hover:underline"
                >
                  See all →
                </Link>
              </div>
              <div className="rounded-[12px] bg-background overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Keyword</th>
                      <th className="text-left px-2 py-3 font-medium w-12">Intent</th>
                      <th className="text-right px-3 py-3 font-medium">Position</th>
                      <th className="text-right px-3 py-3 font-medium">7d Δ</th>
                      <th className="text-left px-4 py-3 font-medium">Why fix it</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapZone.map((g) => {
                      const delta7d =
                        g.weekAgo != null && g.latest != null ? g.weekAgo - g.latest : null;
                      return (
                        <tr key={g.id} className="border-t border-border">
                          <td className="px-4 py-3 truncate max-w-[240px]" title={g.keyword}>
                            {g.keyword}
                          </td>
                          <td className="px-2 py-3">
                            <IntentStageBadge stage={g.intentStage} />
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular">{g.latest}</td>
                          <td className="px-3 py-3 text-right">
                            <RankDelta value={delta7d} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {gapZoneRationale(g)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Position distribution */}
          {ranked.length > 0 && (
            <div className="rounded-[20px] bg-secondary p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Position distribution</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Across {perKeyword.length} tracked keyword{perKeyword.length > 1 ? "s" : ""}.
              </p>
              <div className="flex h-2 rounded-full overflow-hidden bg-background">
                {[
                  { v: buckets.top3, color: "bg-[var(--up)]", label: "1–3" },
                  { v: buckets.top10, color: "bg-[var(--up)]/70", label: "4–10" },
                  { v: buckets.top20, color: "bg-primary/70", label: "11–20" },
                  { v: buckets.top50, color: "bg-primary/40", label: "21–50" },
                  { v: buckets.rest, color: "bg-muted-foreground/40", label: "51–100" },
                  { v: buckets.unranked, color: "bg-[var(--down)]/40", label: "100+" },
                ].map((b, i) =>
                  b.v > 0 ? (
                    <div
                      key={i}
                      className={b.color}
                      style={{ width: `${(b.v / perKeyword.length) * 100}%` }}
                      title={`${b.label}: ${b.v}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-6 grid grid-cols-6 gap-2 text-center">
                <Bucket label="1–3" value={buckets.top3} accent />
                <Bucket label="4–10" value={buckets.top10} accent />
                <Bucket label="11–20" value={buckets.top20} />
                <Bucket label="21–50" value={buckets.top50} />
                <Bucket label="51–100" value={buckets.rest} />
                <Bucket label="100+" value={buckets.unranked} muted />
              </div>
            </div>
          )}

          {/* Top movers */}
          {(topUp.length > 0 || topDown.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoverList title="Top up" items={topUp} direction="up" />
              <MoverList title="Top down" items={topDown} direction="down" />
            </div>
          )}
          {ranked.length > 0 && topUp.length === 0 && topDown.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-border p-5 text-sm text-muted-foreground">
              Movers will appear after a second fetch. Daily cron runs at 06:00 UTC.
            </div>
          )}

          {/* Latest brief preview */}
          {latestBrief.length > 0 && (
            <Link
              href="/dashboard/brief"
              className="block rounded-[20px] bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider opacity-70">
                    Latest AI brief · Week of {latestBrief[0].periodStart} → {latestBrief[0].periodEnd}
                  </div>
                  <p className="mt-4 text-lg md:text-xl leading-snug line-clamp-3">
                    {latestBrief[0].summary}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 mt-1" strokeWidth={1.5} />
              </div>
            </Link>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Setup status */}
          <details
            className="rounded-[20px] bg-secondary overflow-hidden group"
            open={!setupComplete}
          >
            <summary className="px-6 py-5 cursor-pointer list-none flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {setupComplete && (
                    <CheckCircle2 className="h-4 w-4 text-[var(--up)]" strokeWidth={2} />
                  )}
                  <h2 className="text-sm font-semibold">Setup</h2>
                  <span className="text-xs text-muted-foreground font-mono tabular">
                    {steps.filter((s) => s.done).length}/{steps.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {setupComplete ? "Complete. Tap to expand." : "What's actually happening."}
                </p>
              </div>
              <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <ul className="px-2 pb-2">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 rounded-[12px] hover:bg-background/60"
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
                        <FetchNowButton />
                      ) : (
                        <GenerateBriefButton />
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
          </details>

          {/* Schedules */}
          <div className="rounded-[20px] bg-secondary p-6 space-y-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
              Upcoming
            </h2>
            <ScheduleRow
              icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
              label="Next SERP fetch"
              value={formatUntil(nextDailyFetch())}
              when="06:00 UTC daily"
            />
            <ScheduleRow
              icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
              label="Next AI brief"
              value={formatUntil(nextMondayBrief())}
              when="Mondays 09:00 UTC"
            />
          </div>

          {/* Inngest dev hint */}
          {connected && activeKeywords.length > 0 && totalPositions === 0 && (
            <div className="rounded-[20px] border border-border p-4 flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <strong className="text-foreground">No positions yet.</strong> Daily cron runs at
                06:00 UTC. In dev, start{" "}
                <code className="font-mono tabular text-foreground">
                  bunx inngest-cli@latest dev
                </code>
                , then tap <strong>Fetch now</strong>.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent fetch runs — full width */}
      {recentRuns.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Recent fetches
          </h2>
          <div className="rounded-[20px] bg-secondary overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Queued</th>
                  <th className="text-right px-4 py-3 font-medium">Duration</th>
                  <th className="text-right px-4 py-3 font-medium">Result</th>
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
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <RunStatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono tabular">
                        {r.source}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono tabular">
                        {formatRelative(r.queuedAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs font-mono tabular">
                        {dur != null ? `${dur}s` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono tabular">
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

function Bucket({ label, value, accent, muted }: { label: string; value: number; accent?: boolean; muted?: boolean }) {
  return (
    <div>
      <div
        className={`text-lg font-mono tabular ${
          muted ? "text-muted-foreground" : accent ? "text-[var(--up)]" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
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
    <div className="rounded-[20px] bg-secondary p-5">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
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
            <div className="font-mono tabular text-muted-foreground text-xs shrink-0">
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

function StatTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[20px] bg-secondary p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-4 font-display text-4xl md:text-5xl ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </div>
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
      <div className="text-sm font-mono tabular shrink-0">{value}</div>
    </div>
  );
}
