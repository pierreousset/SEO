import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { ArrowRight, ExternalLink } from "lucide-react";
import { RunGapScanButton } from "@/components/run-gap-scan-button";
import { GapStatusBanner } from "@/components/gap-status-banner";
import { TrackGapKeywordButton } from "@/components/track-gap-keyword-button";
import { IntentStageBadge } from "@/components/intent-stage-badge";
import { getUserPlan } from "@/lib/billing-helpers";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export const dynamic = "force-dynamic";

type Finding = NonNullable<typeof schema.competitorGapRuns.$inferSelect["findings"]>[number];

export default async function GapPage() {
  const ctx = await resolveAccountContext();

  const [latestRun] = await db
    .select()
    .from(schema.competitorGapRuns)
    .where(eq(schema.competitorGapRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.competitorGapRuns.queuedAt))
    .limit(1);

  const banner = latestRun
    ? {
        id: latestRun.id,
        status: latestRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestRun.queuedAt.toISOString(),
        startedAt: latestRun.startedAt?.toISOString() ?? null,
        finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        competitorsScanned: latestRun.competitorsScanned,
        keywordsInspected: latestRun.keywordsInspected,
        gapsFound: latestRun.gapsFound,
        costUsd: latestRun.costUsd,
        error: latestRun.error,
      }
    : null;

  const findings = (latestRun?.findings ?? []) as Finding[];

  // Aggregate stats for headline tiles.
  const totalVolume = findings.reduce((s, f) => s + (f.searchVolume ?? 0), 0);
  const commercialCount = findings.filter((f) => (f.intentStage ?? 0) >= 3).length;
  const byCompetitor = new Map<string, number>();
  for (const f of findings) {
    byCompetitor.set(
      f.competitorDomain,
      (byCompetitor.get(f.competitorDomain) ?? 0) + 1,
    );
  }
  const competitorBreakdown = [...byCompetitor.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Competitor keyword gap
          </p>
          <h1 className="font-display text-[40px] mt-3">Gap</h1>
        </div>
        <RunGapScanButton
          label={latestRun ? "Run new scan" : "Run first scan"}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <GapStatusBanner run={banner} />

      {!latestRun && (
        await getUserPlan(ctx.ownerId) === "free" ? (
          <UpgradePrompt
            feature="Competitor Keyword Gap"
            description="Discover keywords your competitors rank for that you don't track yet. Upgrade to Pro to run gap scans."
          />
        ) : (
          <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
            <p className="text-lg">
              Pull the keywords your <strong>declared competitors</strong> rank for and diff them
              against your tracked queries. The gap = what they're winning that you don't even
              track.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Requires at least one competitor URL in{" "}
              <Link href="/dashboard/business" className="underline">
                your business profile
              </Link>
              . Takes 1-3 minutes · ~$0.01/competitor.
            </p>
          </div>
        )
      )}

      {latestRun && latestRun.status === "done" && findings.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10">
          <p className="text-lg">
            <strong>No gap detected.</strong> Every keyword your competitors rank for is either
            already tracked or below our visibility threshold.
          </p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && findings.length > 0 && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label="Gap keywords"
              value={findings.length.toLocaleString()}
              subtitle="competitor-ranked, not yours"
              accent="down"
            />
            <StatTile
              label="Commercial intent"
              value={commercialCount.toLocaleString()}
              subtitle="stage ≥ 3 (solution/buy)"
            />
            <StatTile
              label="Total search volume"
              value={totalVolume.toLocaleString()}
              subtitle="sum of monthly searches"
              muted
            />
          </section>

          {competitorBreakdown.length > 1 && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">By competitor</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                How many gap keywords each competitor owns as their best position.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitorBreakdown.map(([domain, count]) => (
                  <div key={domain} className="rounded-[12px] bg-background p-5">
                    <div className="font-mono tabular text-xs text-muted-foreground truncate">
                      {domain}
                    </div>
                    <div className="mt-3 font-display text-3xl">{count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">gap keywords</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-card p-6 md:p-8">
            <h2 className="font-display text-2xl md:text-3xl">Top opportunities</h2>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Ranked by volume × intent − difficulty. Click <strong>Track</strong> to add to
              your watchlist and start monitoring positions.
            </p>
            <div className="rounded-[12px] bg-background overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Keyword</th>
                    <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal w-12">Intent</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Volume</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">KD</th>
                    <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">CPC</th>
                    <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Best competitor</th>
                    <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Also on</th>
                    <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.slice(0, 200).map((f, i) => (
                    <tr key={`${f.keyword}-${i}`} className="border-b border-border last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-3 truncate max-w-[280px]" title={f.keyword}>
                        {f.keyword}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <IntentStageBadge stage={f.intentStage} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {f.searchVolume?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {f.keywordDifficulty != null ? f.keywordDifficulty : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {f.cpc != null ? `$${f.cpc.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 min-w-0 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular text-xs text-muted-foreground">
                            #{f.competitorPosition}
                          </span>
                          {f.competitorUrl ? (
                            <a
                              href={f.competitorUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-mono tabular text-xs truncate hover:underline inline-flex items-center gap-1.5 min-w-0"
                              title={f.competitorUrl}
                            >
                              <span className="truncate">{f.competitorDomain}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
                            </a>
                          ) : (
                            <span className="font-mono tabular text-xs truncate">
                              {f.competitorDomain}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {f.alsoOn.length > 0 ? (
                          <span
                            className="inline-block font-mono text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 text-foreground"
                            title={f.alsoOn.join(", ")}
                          >
                            +{f.alsoOn.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TrackGapKeywordButton keyword={f.keyword} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {findings.length > 200 && (
              <p className="mt-4 text-xs text-muted-foreground text-center">
                Showing top 200 of {findings.length.toLocaleString()} gap keywords (ranked by
                priority score).
              </p>
            )}
          </section>

          <Link
            href="/dashboard/business"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] opacity-70">expand the scan</div>
                <p className="mt-3 text-lg leading-snug">
                  Add more competitors in your business profile to widen the scan. Each extra
                  competitor reveals their unique keyword territory.
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

function StatTile({
  label,
  value,
  subtitle,
  muted,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  muted?: boolean;
  accent?: "up" | "down";
}) {
  const valueColor = muted
    ? "text-muted-foreground"
    : accent === "down"
      ? "text-[var(--down)]"
      : accent === "up"
        ? "text-[var(--up)]"
        : "text-foreground";
  return (
    <div className="rounded-2xl bg-card p-6">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-4 font-display text-4xl md:text-5xl ${valueColor}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}
