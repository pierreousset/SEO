import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { ExternalLink, FileText, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 28;

export default async function PagesPage() {
  const ctx = await resolveAccountContext();

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Aggregate by URL over the window — one row per indexed page.
  // Server-side aggregation to avoid shipping raw rows.
  const aggregated = await db
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
    .limit(300);

  const totalPages = aggregated.length;
  const totalClicks = aggregated.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = aggregated.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

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
                    let display = r.url;
                    try {
                      const u = new URL(r.url);
                      display = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
                    } catch {}
                    return (
                      <tr key={r.url} className="border-b border-border last:border-0 hover:bg-secondary/50">
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
