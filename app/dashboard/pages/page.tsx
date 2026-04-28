import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { ExternalLink, FileText, ArrowRight } from "lucide-react";
import { detectPageIssues, type PageData, type Issue } from "@/lib/seo-score";
import { IssueCard, type IssueCardData } from "@/components/issue-card";

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
  green: "bg-[#34D399]",
  yellow: "bg-[#FBBF24]",
  red: "bg-[#F87171]",
};

export default async function PagesPage() {
  const ctx = await resolveAccountContext();

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

  // Build prev clicks map
  const prevClicksMap = new Map<string, number>();
  for (const p of prevAggregated) {
    prevClicksMap.set(p.url, p.clicks);
  }

  // If there's a crawl, get meta data for those pages
  let crawlMetaMap = new Map<string, {
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

  const issues: IssueCardData[] = detectPageIssues(pageDataArray) as IssueCardData[];
  const topIssues = issues.slice(0, 5);

  const totalPages = aggregated.length;
  const totalClicks = aggregated.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = aggregated.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

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

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          Indexed pages · last {WINDOW_DAYS} days
        </p>
        <h1 className="font-display text-[40px] mt-3">Pages</h1>
      </header>

      {totalPages === 0 ? (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            No pages yet. Run a GSC history pull from the Overview page — the data shows up
            here 30-60s later.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Pull GSC history <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <>
          {/* Issue cards */}
          {topIssues.length > 0 && (
            <section className="space-y-3">
              <div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  page intelligence
                </span>
                <h2 className="text-xl font-semibold mt-0.5">Issues detected</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topIssues.map((issue) => (
                  <IssueCard key={issue.type} issue={issue} />
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label="Pages indexed" value={totalPages.toLocaleString()} />
            <StatTile label="Total clicks" value={totalClicks.toLocaleString()} />
            <StatTile label="Total impressions" value={totalImpressions.toLocaleString()} />
            <StatTile label="Avg CTR" value={`${avgCtr.toFixed(2)}%`} />
          </section>

          <section className="rounded-2xl bg-card p-6 md:p-8">
            <h2 className="font-display text-2xl md:text-3xl">Top pages</h2>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Any URL with at least one Google impression in the last {WINDOW_DAYS} days counts
              as indexed here. Sorted by clicks.
            </p>
            <div className="rounded-[12px] bg-background overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-center px-2 py-3 font-mono text-[9px] text-muted-foreground font-normal w-8"></th>
                    <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">URL</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Clicks</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Impr.</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">CTR</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Avg pos</th>
                    <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((r) => {
                    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
                    const health = healthMap.get(r.url) ?? "green";
                    let display = r.url;
                    try {
                      const u = new URL(r.url);
                      display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
                    } catch {}
                    return (
                      <tr key={r.url} className="border-b border-border last:border-0 hover:bg-secondary/50">
                        <td className="px-2 py-3 text-center">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${healthDotColor[health]}`}
                            title={
                              health === "red"
                                ? "Critical issues"
                                : health === "yellow"
                                  ? "Warnings"
                                  : "Healthy"
                            }
                          />
                        </td>
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
            {totalPages >= 300 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Showing top 300 by clicks. Re-pull GSC to refresh.
              </p>
            )}
          </section>

          <Link
            href="/dashboard/refresh"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] opacity-70">next</div>
                <p className="mt-3 text-lg leading-snug">
                  See which of these pages are losing ground week after week — the Refresh
                  radar surfaces candidates for a content update.
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
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-4 font-display text-3xl md:text-4xl">{value}</div>
    </div>
  );
}
