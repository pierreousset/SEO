import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Split, ArrowRight, ExternalLink } from "lucide-react";
import { RunCannibalizationButton } from "@/components/run-cannibalization-button";
import { CannibalizationStatusBanner } from "@/components/cannibalization-status-banner";
import { getLocale } from "@/lib/i18n-server";
import { locale, type PageLocale } from "./locale";

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
  const lng = await getLocale();
  const i = locale[lng];

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
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-caption text-ash-gray">{i.headerKicker}</p>
          <h1 className="text-heading-lg mt-2">{i.title}</h1>
        </div>
        <RunCannibalizationButton
          label={latestRun ? i.runNewScan : i.runFirstScan}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <CannibalizationStatusBanner run={banner} />

      {/* Actionable intelligence summary */}
      {latestRun && latestRun.status === "done" && findings.length > 0 && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-card p-5">
            <div className="text-caption text-ash-gray mb-2">{i.intelligenceKicker}</div>
            <p className="text-lg">
              <span className="font-mono tabular-nums font-semibold text-[var(--down)]">
                {findings.length}
              </span>{" "}
              {i.intelligenceLine(findings.length).replace(/^\d+\s*/, "")}
            </p>
          </div>

          {(() => {
            const topGroups = [...findings]
              .sort((a, b) => b.totalImpressions - a.totalImpressions)
              .slice(0, 3);
            return topGroups.length > 0 ? (
              <div>
                <div className="text-caption text-ash-gray mb-3">{i.topGroupsKicker}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {topGroups.map((group, idx) => (
                    <div
                      key={`${group.query}-${idx}`}
                      className="rounded-2xl bg-card p-4 border-l-[3px] border-l-[var(--down)]"
                    >
                      <div className="text-sm font-medium">{group.query}</div>
                      <div className="text-caption text-ash-gray mt-2 tabular-nums">
                        {i.topGroupImpressions(group.totalImpressions, group.urls.length)}
                      </div>
                      <div className="mt-2 space-y-1">
                        {group.urls.slice(0, 3).map((u) => {
                          let display = u.page;
                          try { display = new URL(u.page).pathname || u.page; } catch {}
                          return (
                            <div key={u.page} className="text-caption text-ash-gray truncate" title={u.page}>
                              {display}
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
                        {i.topGroupHint}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </section>
      )}

      {!latestRun && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg" dangerouslySetInnerHTML={{ __html: i.emptyExplain }} />
          <p className="text-sm text-muted-foreground mt-4">{i.emptyRequirement}</p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && findings.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10">
          <p className="text-lg">
            <strong>{i.noFindingsTitle}</strong>{" "}
            {i.noFindingsBody(latestRun.queriesScanned ?? 0, latestRun.daysWindow ?? 0)}
          </p>
          <p className="text-sm text-muted-foreground mt-3">{i.noFindingsHint}</p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && findings.length > 0 && (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label={i.kpiHigh}
              value={byLevel.high.length.toString()}
              subtitle={i.kpiHighSub}
              accent={byLevel.high.length > 0 ? "down" : undefined}
            />
            <StatTile
              label={i.kpiMedium}
              value={byLevel.medium.length.toString()}
              subtitle={i.kpiMediumSub}
            />
            <StatTile
              label={i.kpiQueriesScanned}
              value={(latestRun.queriesScanned ?? 0).toLocaleString()}
              subtitle={i.kpiQueriesScannedSub(latestRun.daysWindow ?? 0)}
              muted
            />
          </section>

          {/* Findings list */}
          <section className="space-y-4">
            {findings.map((f, idx) => (
              <FindingCard key={`${f.query}-${idx}`} finding={f} i={i} />
            ))}
          </section>

          <Link
            href="/dashboard/brief"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-caption opacity-70">{i.ctaKicker}</div>
                <p className="mt-3 text-lg leading-snug">{i.ctaText}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 mt-1" strokeWidth={1.5} />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}

function FindingCard({ finding, i }: { finding: Finding; i: PageLocale }) {
  const topSharePct = Math.round((finding.urls[0]?.share ?? 0) * 100);
  return (
    <div className="rounded-2xl bg-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityPill severity={finding.severity} label={i.severity[finding.severity]} />
            {finding.trackedKeywordId && (
              <span className="inline-block text-caption px-2.5 py-1 rounded-full bg-foreground/10 text-foreground">
                {i.trackedBadge}
              </span>
            )}
          </div>
          <h3 className="text-xl md:text-2xl mt-3 break-words">{finding.query}</h3>
          <p className="text-sm text-muted-foreground mt-2 font-mono tabular">
            {i.findingMeta(
              finding.urls.length,
              finding.totalImpressions,
              finding.totalClicks,
              topSharePct,
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[12px] bg-background overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-caption text-ash-gray">{i.thUrl}</th>
              <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.thImpressions}</th>
              <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.thClicks}</th>
              <th className="text-right px-3 py-3 text-caption text-ash-gray">{i.thAvgPos}</th>
              <th className="text-right px-4 py-3 text-caption text-ash-gray">{i.thShare}</th>
            </tr>
          </thead>
          <tbody>
            {finding.urls.map((u, idx) => {
              const isTop = idx === 0;
              let display = u.page;
              try {
                display = new URL(u.page).pathname || u.page;
              } catch {}
              return (
                <tr key={u.page} className="border-b border-border last:border-0 hover:bg-secondary/50">
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

function SeverityPill({
  severity,
  label,
}: {
  severity: "high" | "medium" | "low";
  label: string;
}) {
  const map = {
    high: "bg-hot-pink/10 text-hot-pink",
    medium: "bg-vivid-violet/10 text-vivid-violet",
    low: "bg-subtle-cream text-ash-gray",
  };
  return (
    <span className={`inline-block text-caption px-2.5 py-1 rounded-full ${map[severity]}`}>
      {label}
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
    <div className="rounded-2xl bg-card p-6">
      <div className="text-caption text-ash-gray">{label}</div>
      <div className={`mt-4 text-display ${valueColor}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}
