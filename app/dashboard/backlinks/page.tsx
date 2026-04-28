import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { ExternalLink, ArrowRight } from "lucide-react";
import { RunBacklinkPullButton } from "@/components/run-backlink-pull-button";
import { BacklinkStatusBanner } from "@/components/backlink-status-banner";

export const dynamic = "force-dynamic";

// Feature flag. Set ENABLE_BACKLINKS=1 in env once a backlinks provider is
// wired and billed. Until then the route shows a "coming soon" state and the
// nav entry is hidden from DashboardLayout.
const BACKLINKS_ENABLED = process.env.ENABLE_BACKLINKS === "1";

export default async function BacklinksPage() {
  const ctx = await resolveAccountContext();

  if (!BACKLINKS_ENABLED) {
    return (
      <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Backlink intelligence
          </p>
          <h1 className="font-display text-[40px] mt-3">Backlinks</h1>
        </header>

        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <span className="inline-block text-[10px] uppercase font-semibold px-2.5 py-1 rounded-full bg-foreground/10 text-foreground">
            Coming with Pro plan
          </span>
          <p className="mt-5 text-lg">
            Total backlinks, referring domains, authority breakdown, <strong>link-gap vs
            competitors</strong> — all wired up. We flip it on for Pro plan subscribers once
            the feature is monetized.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Want early access? Hit me up on{" "}
            <a href="mailto:hello@oussetpierre.com" className="underline">
              hello@oussetpierre.com
            </a>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-border p-6 md:p-8">
          <h2 className="font-display text-xl md:text-2xl">What you'll get</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed list-disc pl-5 text-muted-foreground">
            <li>Total backlinks + referring domains with trend vs last pull.</li>
            <li>Top 50 backlinks sorted by domain authority, with anchor + dofollow flag.</li>
            <li>Top 30 referring domains with rank.</li>
            <li>Side-by-side authority comparison vs your declared competitors.</li>
            <li>
              <strong>Link gap</strong> — domains linking to your competitors but not to you
              (the cleanest outreach list you'll ever get).
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const runs = await db
    .select()
    .from(schema.backlinkRuns)
    .where(eq(schema.backlinkRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.backlinkRuns.queuedAt))
    .limit(2);
  const latestRun = runs[0];
  const previousRun = runs[1];

  const [topLinks, topRefDomains] = latestRun
    ? await Promise.all([
        db
          .select()
          .from(schema.backlinks)
          .where(eq(schema.backlinks.runId, latestRun.id))
          .orderBy(desc(schema.backlinks.domainRank))
          .limit(50),
        db
          .select()
          .from(schema.backlinkRefDomains)
          .where(eq(schema.backlinkRefDomains.runId, latestRun.id))
          .orderBy(desc(schema.backlinkRefDomains.rank))
          .limit(30),
      ])
    : [[], []];

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
        totalBacklinks: latestRun.totalBacklinks,
        referringDomains: latestRun.referringDomains,
        costUsd: latestRun.costUsd,
        error: latestRun.error,
      }
    : null;

  // Compute deltas vs previous run (if any) — "new since last pull".
  const deltaBacklinks =
    latestRun && previousRun
      ? (latestRun.totalBacklinks ?? 0) - (previousRun.totalBacklinks ?? 0)
      : null;
  const deltaRefDomains =
    latestRun && previousRun
      ? (latestRun.referringDomains ?? 0) - (previousRun.referringDomains ?? 0)
      : null;

  const dofollowPct =
    latestRun && (latestRun.totalBacklinks ?? 0) > 0
      ? Math.round(
          ((latestRun.dofollowBacklinks ?? 0) / (latestRun.totalBacklinks ?? 1)) * 100,
        )
      : 0;

  type CompSummary = NonNullable<
    typeof schema.backlinkRuns.$inferSelect["competitorSummaries"]
  >[number];
  const compSummaries = (latestRun?.competitorSummaries ?? []) as CompSummary[];

  // Link gap: domains that link to any competitor but NOT to the user.
  // Uses the top-30 ref domains per competitor (already pulled in the run).
  const userRefDomainSet = new Set(
    topRefDomains.map((d) => d.domain.replace(/^www\./, "").toLowerCase()),
  );
  const linkGapMap = new Map<
    string,
    { domain: string; rank: number | null; linksToCompetitors: string[] }
  >();
  for (const comp of compSummaries) {
    for (const ref of comp.topRefDomains) {
      const k = ref.domain.replace(/^www\./, "").toLowerCase();
      if (userRefDomainSet.has(k)) continue; // already linking to user
      const existing = linkGapMap.get(k);
      if (!existing) {
        linkGapMap.set(k, {
          domain: ref.domain,
          rank: ref.rank,
          linksToCompetitors: [comp.domain],
        });
      } else {
        if (!existing.linksToCompetitors.includes(comp.domain)) {
          existing.linksToCompetitors.push(comp.domain);
        }
        if ((ref.rank ?? 0) > (existing.rank ?? 0)) existing.rank = ref.rank;
      }
    }
  }
  const linkGaps = [...linkGapMap.values()]
    .sort((a, b) => {
      // Domains linking to more competitors are higher signal; then by rank.
      if (b.linksToCompetitors.length !== a.linksToCompetitors.length) {
        return b.linksToCompetitors.length - a.linksToCompetitors.length;
      }
      return (b.rank ?? 0) - (a.rank ?? 0);
    })
    .slice(0, 50);

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Backlink intelligence
          </p>
          <h1 className="font-display text-[40px] mt-3">Backlinks</h1>
        </div>
        <RunBacklinkPullButton
          label={latestRun ? "Pull fresh" : "Pull first report"}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <BacklinkStatusBanner run={banner} />

      {!latestRun && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            Pull your backlink profile from DataForSEO's crawler. You'll see the total links,
            referring domains, domain authority, and the top-authority links pointing at you.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Takes 30-90s · ~$0.03/pull. Re-run anytime to see new/lost links.
          </p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile
              label="Total backlinks"
              value={(latestRun.totalBacklinks ?? 0).toLocaleString()}
              delta={deltaBacklinks}
            />
            <StatTile
              label="Referring domains"
              value={(latestRun.referringDomains ?? 0).toLocaleString()}
              delta={deltaRefDomains}
            />
            <StatTile
              label="Dofollow"
              value={`${dofollowPct}%`}
              subtitle={`${(latestRun.dofollowBacklinks ?? 0).toLocaleString()} links`}
            />
            <StatTile
              label="Broken"
              value={(latestRun.brokenBacklinks ?? 0).toLocaleString()}
              subtitle="unlinked targets"
              muted={(latestRun.brokenBacklinks ?? 0) === 0}
              accent={(latestRun.brokenBacklinks ?? 0) > 0 ? "down" : undefined}
            />
          </section>

          {/* Main grid: top backlinks (2/3) + top ref domains (1/3) */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Top backlinks</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                By domain rank (DataForSEO 0-1000). Green badge = new since last pull.
              </p>
              <div className="rounded-[12px] bg-background overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Source</th>
                      <th className="text-left px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Anchor</th>
                      <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">DR</th>
                      <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Type</th>
                      <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinks.map((l) => {
                      let sourcePath = l.sourceUrl;
                      try {
                        sourcePath = new URL(l.sourceUrl).pathname || l.sourceUrl;
                      } catch {}
                      return (
                        <tr key={l.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                          <td className="px-4 py-3 min-w-0 max-w-[340px]">
                            <a
                              href={l.sourceUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1.5 hover:underline min-w-0 max-w-full"
                              title={l.sourceUrl}
                            >
                              <span className="truncate font-mono tabular text-xs">
                                {l.sourceDomain}
                              </span>
                              <span className="text-muted-foreground/70 text-xs truncate">
                                {sourcePath !== l.sourceDomain ? sourcePath : ""}
                              </span>
                              <ExternalLink
                                className="h-3 w-3 shrink-0 opacity-50"
                                strokeWidth={1.5}
                              />
                            </a>
                          </td>
                          <td className="px-3 py-3 truncate max-w-[200px] text-muted-foreground text-xs">
                            {l.anchor ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono tabular">
                            {l.domainRank ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <DofollowPill dofollow={l.dofollow} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            {l.isNew ? (
                              <span className="inline-block font-mono text-[10px] px-2.5 py-1 rounded-full bg-[var(--up)]/15 text-[var(--up)]">
                                new
                              </span>
                            ) : l.isLost ? (
                              <span className="inline-block font-mono text-[10px] px-2.5 py-1 rounded-full bg-[var(--down)]/15 text-[var(--down)]">
                                lost
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {topLinks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          No backlinks found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Top referring domains</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                By authority. A few strong links beat many weak ones.
              </p>
              <div className="space-y-2">
                {topRefDomains.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-[12px] bg-background px-4 py-3"
                  >
                    <div className="flex-1 min-w-0 truncate font-mono tabular text-xs" title={d.domain}>
                      {d.domain}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono tabular shrink-0">
                      {d.backlinks} link{d.backlinks > 1 ? "s" : ""}
                    </div>
                    <div className="text-sm font-mono tabular shrink-0 w-10 text-right">
                      {d.rank ?? "—"}
                    </div>
                  </div>
                ))}
                {topRefDomains.length === 0 && (
                  <p className="text-sm text-muted-foreground">No referring domains found.</p>
                )}
              </div>
            </div>
          </section>

          {/* vs competitors — side-by-side authority comparison */}
          {compSummaries.length > 0 && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">vs your competitors</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Authority comparison based on this pull. Positive delta = you beat them.
              </p>
              <div className="rounded-[12px] bg-background overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Domain</th>
                      <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Backlinks</th>
                      <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Ref domains</th>
                      <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Dofollow</th>
                      <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Avg rank</th>
                      <th className="text-right px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Δ ref domains</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border bg-foreground/5">
                      <td className="px-4 py-3 font-medium">You</td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {(latestRun.totalBacklinks ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {(latestRun.referringDomains ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {(latestRun.dofollowBacklinks ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        {latestRun.avgRefDomainRank ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                    </tr>
                    {compSummaries.map((c) => {
                      const deltaRef =
                        (latestRun.referringDomains ?? 0) - c.referringDomains;
                      return (
                        <tr key={c.domain} className="border-b border-border last:border-0 hover:bg-secondary/50">
                          <td className="px-4 py-3 font-mono tabular text-xs truncate max-w-[240px]">
                            {c.domain}
                            {c.error && (
                              <span
                                className="ml-2 font-mono text-[10px] px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                                title={c.error}
                              >
                                err
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular">
                            {c.totalBacklinks.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular">
                            {c.referringDomains.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular">
                            {c.dofollowBacklinks.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular">
                            {c.avgRefDomainRank ?? "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono tabular ${
                              deltaRef > 0
                                ? "text-[var(--up)]"
                                : deltaRef < 0
                                  ? "text-[var(--down)]"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {deltaRef > 0 ? `+${deltaRef.toLocaleString()}` : deltaRef.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Link gap — domains linking to competitors but not to you */}
          {linkGaps.length > 0 && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <div className="font-mono text-[10px] text-muted-foreground">
                Outreach
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">Link gap</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Domains that link to your competitors but not to you. The more competitors
                they link to, the higher the signal — and the more likely they'd link to you
                with the right pitch.
              </p>
              <div className="rounded-[12px] bg-background overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Domain</th>
                      <th className="text-center px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">Rank</th>
                      <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">Links to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkGaps.map((g) => (
                      <tr key={g.domain} className="border-b border-border last:border-0 hover:bg-secondary/50">
                        <td className="px-4 py-3 font-mono tabular text-xs truncate max-w-[280px]">
                          <a
                            href={`https://${g.domain}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 hover:underline"
                          >
                            <span className="truncate">{g.domain}</span>
                            <ExternalLink
                              className="h-3 w-3 shrink-0 opacity-50"
                              strokeWidth={1.5}
                            />
                          </a>
                        </td>
                        <td className="px-3 py-3 text-center font-mono tabular">
                          {g.rank ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {g.linksToCompetitors.map((c) => (
                              <span
                                key={c}
                                className="inline-block font-mono text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 text-foreground"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Showing top 50. Limited to top 30 ref domains per competitor — a fresh pull
                rotates the sample.
              </p>
            </section>
          )}

          {previousRun && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-mono text-[10px] text-muted-foreground">
                Compared to previous pull
              </h2>
              <p className="text-sm mt-3">
                Previous pull from{" "}
                <strong>
                  {new Date(previousRun.queuedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
                : {(previousRun.totalBacklinks ?? 0).toLocaleString()} backlinks,{" "}
                {(previousRun.referringDomains ?? 0).toLocaleString()} ref domains.
              </p>
            </section>
          )}

          <Link
            href="/dashboard/gap"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] opacity-70">link outreach</div>
                <p className="mt-3 text-lg leading-snug">
                  Domains that link to your <strong>competitors</strong> but not to you are the
                  cleanest outreach targets. Cross-reference against your Gap scan.
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
  delta,
  muted,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number | null;
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
      <div className={`mt-4 font-display text-3xl md:text-4xl ${valueColor}`}>{value}</div>
      {delta !== undefined && delta !== null && delta !== 0 && (
        <div
          className={`mt-2 text-xs font-mono tabular ${delta > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}
        >
          {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()} since last pull
        </div>
      )}
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}

function DofollowPill({ dofollow }: { dofollow: boolean }) {
  return (
    <span
      className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${
        dofollow
          ? "bg-[var(--up)]/15 text-[var(--up)]"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {dofollow ? "dofollow" : "nofollow"}
    </span>
  );
}
