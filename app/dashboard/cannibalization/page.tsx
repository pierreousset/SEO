import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Split, ArrowRight, ExternalLink } from "lucide-react";
import { RunCannibalizationButton } from "@/components/run-cannibalization-button";
import { CannibalizationStatusBanner } from "@/components/cannibalization-status-banner";

export const dynamic = "force-dynamic";

type Finding = {
  query: string;
  trackedKeywordId: string | null;
  severity: "high" | "medium" | "low";
  totalImpressions: number;
  totalClicks: number;
  urls: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
    share: number;
  }>;
};

export default async function CannibalizationPage() {
  const ctx = await resolveAccountContext();

  const [latestRun] = await db
    .select()
    .from(schema.cannibalizationRuns)
    .where(eq(schema.cannibalizationRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.cannibalizationRuns.queuedAt))
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
        queriesScanned: latestRun.queriesScanned,
        findingsCount: latestRun.findingsCount,
        error: latestRun.error,
      }
    : null;

  const findings = ((latestRun?.findings as Finding[]) ?? []);
  const byLevel = {
    high: findings.filter((f) => f.severity === "high"),
    medium: findings.filter((f) => f.severity === "medium"),
    low: findings.filter((f) => f.severity === "low"),
  };

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Keyword cannibalization
          </p>
          <h1 className="font-display text-[40px] mt-3">Cannibalization</h1>
        </div>
        <RunCannibalizationButton
          label={latestRun ? "Run new scan" : "Run first scan"}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <CannibalizationStatusBanner run={banner} />

      {!latestRun && (
        <div className="rounded-2xl bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            When <strong>two or more of your own pages</strong> compete for the same keyword,
            Google splits authority and impressions — and nobody wins. This scan pulls GSC
            query×page data and surfaces the worst offenders.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Requires GSC connected. Takes 30-90s depending on your site size.
          </p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && findings.length === 0 && (
        <div className="rounded-2xl bg-secondary p-8 md:p-10">
          <p className="text-lg">
            <strong>No cannibalization detected.</strong> Scanned{" "}
            {latestRun.queriesScanned ?? 0} queries over the last{" "}
            {latestRun.daysWindow}d — every query has a clear winning URL.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            If you know of a query where multiple pages overlap, re-run the scan after adding
            more tracked keywords or waiting for more impressions data.
          </p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && findings.length > 0 && (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label="High severity"
              value={byLevel.high.length.toString()}
              subtitle="top URL holds < 50% share"
              accent={byLevel.high.length > 0 ? "down" : undefined}
            />
            <StatTile
              label="Medium severity"
              value={byLevel.medium.length.toString()}
              subtitle="top URL holds < 70% share"
            />
            <StatTile
              label="Queries scanned"
              value={(latestRun.queriesScanned ?? 0).toLocaleString()}
              subtitle={`last ${latestRun.daysWindow}d of GSC data`}
              muted
            />
          </section>

          {/* Findings list */}
          <section className="space-y-4">
            {findings.map((f, i) => (
              <FindingCard key={`${f.query}-${i}`} finding={f} />
            ))}
          </section>

          <Link
            href="/dashboard/brief"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-wider opacity-70">
                  How to fix cannibalization
                </div>
                <p className="mt-3 text-lg leading-snug">
                  Pick the URL you want to rank. Consolidate content from the losing URLs into
                  it, add 301 redirects from the losers, and update internal links. Typical
                  time-to-effect: 2-4 weeks.
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

function FindingCard({ finding }: { finding: Finding }) {
  const topShare = finding.urls[0]?.share ?? 0;
  return (
    <div className="rounded-2xl bg-secondary p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityPill severity={finding.severity} />
            {finding.trackedKeywordId && (
              <span className="text-[10px] uppercase font-medium px-2.5 py-1 rounded-full bg-foreground/10 text-foreground">
                tracked
              </span>
            )}
          </div>
          <h3 className="font-display text-xl md:text-2xl mt-3 break-words">{finding.query}</h3>
          <p className="text-sm text-muted-foreground mt-2 font-mono tabular">
            {finding.urls.length} URLs · {finding.totalImpressions.toLocaleString()}{" "}
            impressions · {finding.totalClicks.toLocaleString()} clicks · top URL holds{" "}
            {Math.round(topShare * 100)}% of impressions
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[12px] bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">URL</th>
              <th className="text-right px-3 py-3 font-medium">Impressions</th>
              <th className="text-right px-3 py-3 font-medium">Clicks</th>
              <th className="text-right px-3 py-3 font-medium">Avg pos</th>
              <th className="text-right px-4 py-3 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {finding.urls.map((u, i) => {
              const isTop = i === 0;
              let display = u.page;
              try {
                display = new URL(u.page).pathname || u.page;
              } catch {}
              return (
                <tr key={u.page} className="border-t border-border">
                  <td className="px-4 py-3 min-w-0 max-w-[420px]">
                    <a
                      href={u.page}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono tabular text-xs truncate hover:underline inline-flex items-center gap-1.5 max-w-full"
                      title={u.page}
                    >
                      <span className="truncate">{display}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    {u.impressions.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    {u.clicks.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">{u.position}</td>
                  <td className="px-4 py-3 text-right">
                    <ShareBar share={u.share} isTop={isTop} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShareBar({ share, isTop }: { share: number; isTop: boolean }) {
  const pct = Math.round(share * 100);
  return (
    <div className="inline-flex items-center gap-2 w-full justify-end">
      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${isTop ? "bg-foreground" : "bg-muted-foreground/60"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular text-muted-foreground w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

function SeverityPill({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-[var(--down)]/15 text-[var(--down)]",
    medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase font-semibold px-2.5 py-1 rounded-full ${map[severity]}`}
    >
      {severity}
    </span>
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
    <div className="rounded-2xl bg-secondary p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-4 font-display text-4xl md:text-5xl ${valueColor}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}
