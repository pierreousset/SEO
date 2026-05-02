import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { ExternalLink, FileText, ArrowRight, Search as SearchIcon } from "lucide-react";
import { detectPageIssues, type PageData } from "@/lib/seo-score";
import { IssueCard, type IssueCardData } from "@/components/issue-card";
import { MetaSuggestionButton } from "@/components/meta-suggestion-button";
import { detectContentDecay } from "@/lib/content-decay";
import { DecayMiniChart } from "@/components/decay-mini-chart";
import { CheckVitalsButton } from "@/components/check-vitals-button";
import { SortableHeader } from "@/components/sortable-header";
import { parseSort, sortRows } from "@/lib/table-sort";
import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 28;

// CTR benchmarks for health dot (same as seo-score.ts)
const CTR_BENCHMARK: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.06, 5: 0.06,
  6: 0.03, 7: 0.03, 8: 0.03, 9: 0.03, 10: 0.03,
};
function expectedCtr(position: number): number {
  if (position <= 0) return 0;
  if (position <= 10) return CTR_BENCHMARK[Math.round(position)] ?? 0.03;
  if (position <= 20) return 0.01;
  return 0.003;
}

type RowHealth = "green" | "yellow" | "red";

function computeRowHealth(row: {
  clicks: number;
  impressions: number;
  avgPosition: number;
  titleLength: number | null;
  metaLength: number | null;
}): RowHealth {
  // Critical: missing title or zero clicks with impressions
  if (row.titleLength !== null && row.titleLength === 0) return "red";
  if (row.impressions > 20 && row.clicks === 0) return "red";

  // Warnings
  let warnings = 0;
  if (row.titleLength !== null && row.titleLength < 30) warnings++;
  if (row.metaLength !== null && row.metaLength < 50) warnings++;
  if (row.impressions > 50 && row.avgPosition <= 20) {
    const actual = row.clicks / row.impressions;
    const expected = expectedCtr(row.avgPosition);
    if (actual < expected * 0.5) warnings++;
  }

  if (warnings >= 2) return "yellow";
  if (warnings === 1) return "yellow";
  return "green";
}

const healthDotColor: Record<RowHealth, string> = {
  green: "bg-sky-teal",
  yellow: "bg-vivid-violet",
  red: "bg-hot-pink",
};

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveAccountContext();
  const lng = await getLocale();
  const i = locale[lng];
  const sp = await searchParams;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Previous 28-day window for delta
  const prevCutoff = new Date();
  prevCutoff.setUTCDate(prevCutoff.getUTCDate() - WINDOW_DAYS * 2);
  const prevCutoffStr = prevCutoff.toISOString().slice(0, 10);

  // Aggregate by URL over the window — one row per indexed page.
  const [aggregated, prevAggregated, latestCrawlRuns] = await Promise.all([
    db
      .select({
        url: schema.gscPageMetrics.url,
        clicks: sql<number>`sum(${schema.gscPageMetrics.clicks})::int`,
        impressions: sql<number>`sum(${schema.gscPageMetrics.impressions})::int`,
        avgPosition: sql<number>`avg(${schema.gscPageMetrics.position}::numeric)::float`,
        days: sql<number>`count(distinct ${schema.gscPageMetrics.date})::int`,
        lastDate: sql<string>`max(${schema.gscPageMetrics.date})`,
      })
      .from(schema.gscPageMetrics)
      .where(
        and(
          eq(schema.gscPageMetrics.userId, ctx.ownerId),
          gte(schema.gscPageMetrics.date, cutoffStr),
        ),
      )
      .groupBy(schema.gscPageMetrics.url)
      .orderBy(desc(sql`sum(${schema.gscPageMetrics.clicks})`))
      .limit(300),
    db
      .select({
        url: schema.gscPageMetrics.url,
        clicks: sql<number>`sum(${schema.gscPageMetrics.clicks})::int`,
      })
      .from(schema.gscPageMetrics)
      .where(
        and(
          eq(schema.gscPageMetrics.userId, ctx.ownerId),
          gte(schema.gscPageMetrics.date, prevCutoffStr),
          sql`${schema.gscPageMetrics.date} < ${cutoffStr}`,
        ),
      )
      .groupBy(schema.gscPageMetrics.url),
    db
      .select()
      .from(schema.metaCrawlRuns)
      .where(
        and(
          eq(schema.metaCrawlRuns.userId, ctx.ownerId),
          eq(schema.metaCrawlRuns.status, "done"),
        ),
      )
      .orderBy(desc(schema.metaCrawlRuns.finishedAt))
      .limit(1),
  ]);

  // Content decay: fetch raw daily page metrics for the last 28 days
  const decayCutoff = new Date();
  decayCutoff.setUTCDate(decayCutoff.getUTCDate() - 28);
  const decayCutoffStr = decayCutoff.toISOString().slice(0, 10);

  const dailyPageMetrics = await db
    .select({
      url: schema.gscPageMetrics.url,
      date: schema.gscPageMetrics.date,
      clicks: schema.gscPageMetrics.clicks,
    })
    .from(schema.gscPageMetrics)
    .where(
      and(
        eq(schema.gscPageMetrics.userId, ctx.ownerId),
        gte(schema.gscPageMetrics.date, decayCutoffStr),
      ),
    );

  const decayingPages = detectContentDecay(dailyPageMetrics);

  // Core Web Vitals — latest 20 results for this user
  const vitals = await db
    .select()
    .from(schema.webVitals)
    .where(eq(schema.webVitals.userId, ctx.ownerId))
    .orderBy(desc(schema.webVitals.fetchedAt))
    .limit(20);

  // Build prev clicks map
  const prevClicksMap = new Map<string, number>();
  for (const p of prevAggregated) {
    prevClicksMap.set(p.url, p.clicks);
  }

  // If there's a crawl, get meta data for those pages
  const crawlMetaMap = new Map<string, {
    title: string | null;
    titleLength: number | null;
    metaDescription: string | null;
    metaDescriptionLength: number | null;
    h1: string | null;
  }>();

  if (latestCrawlRuns.length > 0) {
    const crawlPages = await db
      .select({
        url: schema.metaCrawlPages.url,
        title: schema.metaCrawlPages.title,
        titleLength: schema.metaCrawlPages.titleLength,
        metaDescription: schema.metaCrawlPages.metaDescription,
        metaDescriptionLength: schema.metaCrawlPages.metaDescriptionLength,
        h1: schema.metaCrawlPages.h1,
      })
      .from(schema.metaCrawlPages)
      .where(eq(schema.metaCrawlPages.runId, latestCrawlRuns[0].id));

    for (const p of crawlPages) {
      crawlMetaMap.set(p.url, p);
    }
  }

  // Build PageData array for detectPageIssues
  const pageDataArray: PageData[] = aggregated.map((r) => {
    const meta = crawlMetaMap.get(r.url);
    return {
      url: r.url,
      clicks28d: r.clicks,
      impressions28d: r.impressions,
      avgPosition: r.avgPosition,
      clicksPrev28d: prevClicksMap.get(r.url) ?? 0,
      title: meta?.title ?? null,
      titleLength: meta?.titleLength ?? 0,
      metaDescription: meta?.metaDescription ?? null,
      metaDescriptionLength: meta?.metaDescriptionLength ?? 0,
      h1: meta?.h1 ?? null,
      inSitemap: true, // we don't have sitemap data per-page here
      indexable: true,
    };
  });

  const issues: IssueCardData[] = detectPageIssues(pageDataArray, i.issues) as IssueCardData[];
  const topIssues = issues.slice(0, 5);

  const totalPages = aggregated.length;
  const totalClicks = aggregated.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = aggregated.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // ── Sortable Top Pages table ───────────────────────────────────
  const { field: sortField, dir: sortDir } = parseSort(sp, "clicks", "desc");
  const aggregatedSorted = sortRows(aggregated, sortField, sortDir, {
    url: (r) => r.url,
    clicks: (r) => r.clicks,
    impressions: (r) => r.impressions,
    ctr: (r) => (r.impressions > 0 ? r.clicks / r.impressions : 0),
    avgPosition: (r) => r.avgPosition,
    lastDate: (r) => r.lastDate,
  });

  // Browse filter + search state
  const browseQuery = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const browseFilter =
    typeof sp.filter === "string" && (sp.filter === "issues" || sp.filter === "healthy")
      ? sp.filter
      : "all";
  const showAll = sp.show === "all";
  const DEFAULT_LIMIT = 50;

  // Build health lookup
  const healthMap = new Map<string, RowHealth>();
  for (const r of aggregated) {
    const meta = crawlMetaMap.get(r.url);
    healthMap.set(
      r.url,
      computeRowHealth({
        clicks: r.clicks,
        impressions: r.impressions,
        avgPosition: r.avgPosition,
        titleLength: meta?.titleLength ?? null,
        metaLength: meta?.metaDescriptionLength ?? null,
      }),
    );
  }

  // Filter the sorted aggregate for the browse table.
  const browseRowsAll = aggregatedSorted.filter((r) => {
    if (browseQuery && !r.url.toLowerCase().includes(browseQuery)) return false;
    if (browseFilter === "issues") {
      const h = healthMap.get(r.url);
      if (h !== "yellow" && h !== "red") return false;
    } else if (browseFilter === "healthy") {
      const h = healthMap.get(r.url);
      if (h !== "green") return false;
    }
    return true;
  });
  const browseRows = showAll ? browseRowsAll : browseRowsAll.slice(0, DEFAULT_LIMIT);

  // Hero insight: zero-click pages count + recovery estimate.
  const zeroClickPages = aggregated.filter(
    (r) => r.impressions > 20 && r.clicks === 0,
  );
  const zeroClickImpressions = zeroClickPages.reduce(
    (acc, p) => acc + p.impressions,
    0,
  );

  // Top-10 by impressions for the hero bar chart.
  const topByImpressions = [...aggregated]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
  const heroChartMax = topByImpressions[0]?.impressions ?? 0;

  // Build a stable search-params helper: append/override one key without
  // dropping the others (sort, dir, group, etc.).
  function urlWith(updates: Record<string, string | null>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") params.set(k, v);
    }
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  }

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-caption text-ash-gray">
          {i.headerKicker(WINDOW_DAYS)}
        </p>
        <h1 className="text-heading-lg mt-2">{i.title}</h1>
      </header>

      {totalPages === 0 ? (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            {i.emptyTitle}
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            {i.emptyCta} <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <>
          {/* HERO INSIGHT — zero-click pages + top 10 by impressions */}
          {zeroClickPages.length > 0 && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="text-caption text-ash-gray">{i.heroKicker}</span>
                  <div className="mt-2 text-display tabular-nums text-hot-pink">
                    {zeroClickPages.length}
                  </div>
                  <p className="mt-3 text-body text-deep-slate leading-relaxed">
                    {i.heroBigSubtitle(zeroClickPages.length, totalPages)}
                  </p>
                  <p className="mt-2 text-body-sm text-ash-gray font-mono tabular-nums">
                    {zeroClickImpressions.toLocaleString()} impressions ·{" "}
                    {WINDOW_DAYS}d
                  </p>
                </div>
                <div>
                  <div className="text-caption text-ash-gray mb-3">
                    {i.heroChartTitle}
                  </div>
                  <div className="space-y-1.5">
                    {topByImpressions.map((p) => {
                      let display = p.url;
                      try {
                        const u = new URL(p.url);
                        display = u.pathname === "/" ? u.hostname : u.pathname;
                      } catch {}
                      const pct =
                        heroChartMax > 0
                          ? (p.impressions / heroChartMax) * 100
                          : 0;
                      return (
                        <div
                          key={p.url}
                          className="grid grid-cols-[1fr_60px] items-center gap-3"
                          title={p.url}
                        >
                          <div className="relative h-5 rounded-full bg-canvas-white overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-sky-teal/80 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative px-2.5 leading-5 text-[11px] font-medium truncate">
                              {display}
                            </div>
                          </div>
                          <div className="text-caption font-mono tabular-nums text-ash-gray text-right">
                            {p.impressions.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* COMPACT KPI STRIP */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile label={i.statPagesIndexed} value={totalPages.toLocaleString()} />
            <KpiTile label={i.statTotalClicks} value={totalClicks.toLocaleString()} />
            <KpiTile label={i.statTotalImpressions} value={totalImpressions.toLocaleString()} />
            <KpiTile label={i.statAvgCtr} value={`${avgCtr.toFixed(2)}%`} />
          </section>

          {/* ACTION QUEUE — top 3 issues, full-width cards with bigger CTAs */}
          {topIssues.length > 0 && (
            <section className="space-y-3">
              <div>
                <span className="text-caption text-ash-gray">{i.actionQueueKicker}</span>
                <h2 className="text-xl font-semibold mt-0.5">{i.actionQueueTitle}</h2>
              </div>
              <div className="space-y-3">
                {topIssues.slice(0, 3).map((issue) => {
                  const showMetaCta =
                    issue.type === "title_missing" ||
                    issue.type === "title_short" ||
                    issue.type === "meta_missing" ||
                    issue.type === "low_ctr_for_position";
                  const firstPage = issue.affectedPages?.[0];
                  return (
                    <IssueCard key={issue.type} issue={issue} labels={i.issueCard}>
                      {showMetaCta && firstPage && (
                        <MetaSuggestionButton url={firstPage} labels={i.metaSuggestion} />
                      )}
                    </IssueCard>
                  );
                })}
              </div>
            </section>
          )}

          {/* Core Web Vitals */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="text-caption text-ash-gray">
                  {i.vitalsKicker}
                </span>
                <h2 className="text-xl font-semibold mt-0.5">{i.vitalsTitle}</h2>
              </div>
              <CheckVitalsButton />
            </div>
            {vitals.length > 0 ? (
              <div className="rounded-2xl bg-card p-6 md:p-8">
                <div className="rounded-[12px] bg-background overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-4 py-3 text-caption text-ash-gray">{i.vitalsThUrl}</th>
                        <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.vitalsThScore}</th>
                        <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.vitalsThLcp}</th>
                        <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.vitalsThFcp}</th>
                        <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.vitalsThCls}</th>
                        <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.vitalsThTtfb}</th>
                        <th className="text-right px-4 py-3 text-caption text-ash-gray">{i.vitalsThChecked}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals.map((v) => {
                        let display = v.url;
                        try {
                          const u = new URL(v.url);
                          display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
                        } catch {}
                        const score = v.performanceScore ?? 0;
                        const scoreColor =
                          score >= 90
                            ? "text-[#0098f2]"
                            : score >= 50
                              ? "text-[#f200ca]"
                              : "text-[#f200ca]";
                        return (
                          <tr key={v.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                            <td className="px-4 py-3 font-mono tabular text-xs truncate max-w-[300px]" title={v.url}>
                              {display}
                            </td>
                            <td className={`px-3 py-3 text-right font-mono tabular font-semibold ${scoreColor}`}>
                              {score}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular">
                              {v.lcp != null ? `${(v.lcp / 1000).toFixed(1)}s` : "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular">
                              {v.fcp != null ? `${(v.fcp / 1000).toFixed(1)}s` : "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular">
                              {v.cls != null ? v.cls.toFixed(3) : "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular">
                              {v.ttfb != null ? `${v.ttfb}ms` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular text-xs text-muted-foreground">
                              {new Date(v.fetchedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">
                {i.vitalsEmpty}
              </div>
            )}
          </section>

          {/* Content Decay */}
          {decayingPages.length > 0 && (
            <section className="space-y-3">
              <div>
                <span className="text-caption text-ash-gray">
                  {i.decayKicker}
                </span>
                <h2 className="text-xl font-semibold mt-0.5">
                  {i.decayTitle}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {decayingPages.map((page) => {
                  let display = page.url;
                  try {
                    const u = new URL(page.url);
                    display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
                  } catch {}
                  const severityColor =
                    page.severity === "high"
                      ? "bg-hot-pink/10 text-hot-pink"
                      : page.severity === "medium"
                        ? "bg-vivid-violet/10 text-vivid-violet"
                        : "bg-subtle-cream text-ash-gray";
                  return (
                    <div
                      key={page.url}
                      className="rounded-[12px] bg-card p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-mono tabular text-xs truncate hover:underline max-w-[80%]"
                          title={page.url}
                        >
                          {display}
                        </a>
                        <span
                          className={`inline-block text-caption px-2.5 py-1 rounded-full shrink-0 ${severityColor}`}
                        >
                          {page.severity}
                        </span>
                      </div>
                      <DecayMiniChart weeks={page.weeklyClickTrend} />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono tabular">
                        <span>{i.decayPerWeek(page.decayRate)}</span>
                        <span>{i.decayClicksLost(page.totalClicksLost)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* BROWSE ALL PAGES — search + filter chips + collapsible table */}
          <section className="rounded-2xl bg-card p-6 md:p-8 space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-heading">{i.topPagesTitle}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {i.topPagesSubtitle(WINDOW_DAYS)}
                </p>
              </div>
            </div>

            {/* Search + filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              <form
                action=""
                className="relative flex-1 min-w-[240px] max-w-md"
              >
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash-gray pointer-events-none"
                  strokeWidth={1.5}
                />
                {/* Preserve other params on submit */}
                {Object.entries(sp).map(([k, v]) =>
                  k === "q" || typeof v !== "string" ? null : (
                    <input key={k} type="hidden" name={k} value={v} />
                  ),
                )}
                <input
                  type="text"
                  name="q"
                  defaultValue={browseQuery}
                  placeholder={i.browseSearchPlaceholder}
                  className="w-full h-10 pl-10 pr-3 text-body-sm bg-canvas-white border border-hairline rounded-full focus:outline-none focus:ring-2 focus:ring-sky-teal/30 focus:border-sky-teal"
                />
              </form>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["all", i.browseFilterAll],
                    ["issues", i.browseFilterIssues],
                    ["healthy", i.browseFilterHealthy],
                  ] as const
                ).map(([key, label]) => {
                  const active = browseFilter === key;
                  return (
                    <Link
                      key={key}
                      href={urlWith({
                        filter: key === "all" ? null : key,
                        show: null,
                      })}
                      className={`text-body-sm px-3 py-1.5 rounded-full transition-colors ${
                        active
                          ? "bg-button-black text-canvas-white"
                          : "bg-canvas-white text-ash-gray hover:text-ink-black border border-hairline"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[12px] bg-background overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3">
                      <SortableHeader field="url" label={i.thUrl} currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-right px-3 py-3">
                      <SortableHeader field="clicks" label={i.thClicks} align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-right px-3 py-3">
                      <SortableHeader field="impressions" label={i.thImpr} align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-right px-3 py-3">
                      <SortableHeader field="ctr" label={i.thCtr} align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-right px-3 py-3">
                      <SortableHeader field="avgPosition" label={i.thAvgPos} align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-right px-4 py-3">
                      <SortableHeader field="lastDate" label={i.thLastSeen} align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {browseRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-body-sm text-muted-foreground">
                        {i.browseEmpty}
                      </td>
                    </tr>
                  )}
                  {browseRows.map((r) => {
                    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
                    let display = r.url;
                    try {
                      const u = new URL(r.url);
                      display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
                    } catch {}
                    return (
                      <tr key={r.url} className="border-b border-border last:border-0 hover:bg-subtle-cream">
                        <td className="px-4 py-3 min-w-0 max-w-[480px]">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 hover:underline min-w-0 max-w-full"
                            title={r.url}
                          >
                            <FileText
                              className="h-3.5 w-3.5 shrink-0 opacity-50"
                              strokeWidth={1.5}
                            />
                            <span className="truncate font-mono tabular text-xs">{display}</span>
                            <ExternalLink
                              className="h-3 w-3 shrink-0 opacity-50"
                              strokeWidth={1.5}
                            />
                          </a>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular">
                          {r.clicks.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular">
                          {r.impressions.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular">
                          {ctr.toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular">
                          {r.avgPosition.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular text-xs text-muted-foreground">
                          {r.lastDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Show more / show less */}
            {browseRowsAll.length > DEFAULT_LIMIT && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-caption text-ash-gray font-mono tabular-nums">
                  {i.browseShowingTop(browseRows.length, browseRowsAll.length)}
                </span>
                <Link
                  href={urlWith({ show: showAll ? null : "all" })}
                  className="text-body-sm font-medium text-sky-teal hover:underline"
                >
                  {showAll ? i.browseShowLess : i.browseShowAll}
                </Link>
              </div>
            )}
          </section>

          <Link
            href="/dashboard/refresh"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-caption opacity-70">{i.ctaKicker}</div>
                <p className="mt-3 text-lg leading-snug">
                  {i.ctaText}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 mt-1" strokeWidth={1.5} />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-6">
      <div className="text-caption text-ash-gray">{label}</div>
      <div className="mt-4 text-heading">{value}</div>
    </div>
  );
}

// Compact KPI tile used in the post-hero strip — denser than StatTile.
function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-4">
      <div className="text-caption text-ash-gray">{label}</div>
      <div className="mt-1 text-subheading font-semibold tabular-nums">{value}</div>
    </div>
  );
}
