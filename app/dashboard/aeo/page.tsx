import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Sparkles, ArrowRight } from "lucide-react";
import { RunAeoCheckButton } from "@/components/run-aeo-check-button";
import { AeoStatusBanner } from "@/components/aeo-status-banner";

export const dynamic = "force-dynamic";

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  claude: "Claude",
  openai: "ChatGPT",
};

export default async function AeoPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);

  const [latestRun] = await db
    .select()
    .from(schema.llmVisibilityRuns)
    .where(eq(schema.llmVisibilityRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.llmVisibilityRuns.queuedAt))
    .limit(1);

  const [results, keywords, sites, profile] = await Promise.all([
    latestRun
      ? db
          .select()
          .from(schema.llmVisibilityResults)
          .where(eq(schema.llmVisibilityResults.runId, latestRun.id))
      : Promise.resolve([] as Array<typeof schema.llmVisibilityResults.$inferSelect>),
    t.selectKeywords(),
    t.selectSites(),
    t.selectBusinessProfile(),
  ]);

  const keywordById = new Map(keywords.map((k) => [k.id, k]));
  const userDomain = (sites[0]?.domain ?? "").replace(/^www\./, "").toLowerCase();

  // Competitors declared in /dashboard/business. Normalize URL → domain.
  function urlToDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return url.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    }
  }
  const declaredCompetitors = ((profile?.competitorUrls ?? []) as string[])
    .map(urlToDomain)
    .filter((d) => d && d !== userDomain);

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
        keywordCount: latestRun.keywordCount,
        checkCount: latestRun.checkCount,
        mentionedCount: latestRun.mentionedCount,
        costUsd: latestRun.costUsd,
        error: latestRun.error,
      }
    : null;

  const enginesUsed = (latestRun?.engines as string[]) ?? [];
  const mentionRate =
    (latestRun?.checkCount ?? 0) > 0
      ? Math.round(((latestRun?.mentionedCount ?? 0) / (latestRun?.checkCount ?? 1)) * 100)
      : 0;

  // Per-keyword matrix: row = keyword, col = engine
  type Cell = (typeof results)[number] | null;
  const matrix = new Map<string, Map<string, Cell>>();
  for (const r of results) {
    if (!matrix.has(r.keywordId)) matrix.set(r.keywordId, new Map());
    matrix.get(r.keywordId)!.set(r.engine, r);
  }

  // Per-engine stats (for summary row)
  const engineStats = enginesUsed.map((e) => {
    const rows = results.filter((r) => r.engine === e);
    const cited = rows.filter((r) => r.mentioned).length;
    return { engine: e, total: rows.length, cited };
  });

  // Most-cited competitor domains across the run (all non-user citations)
  const competitorCounts = new Map<string, number>();
  for (const r of results) {
    for (const c of (r.competitorMentions as Array<{ domain: string }>) ?? []) {
      competitorCounts.set(c.domain, (competitorCounts.get(c.domain) ?? 0) + 1);
    }
  }
  const topCompetitors = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Declared-competitor showdown: per keyword, how many engines cited each declared
  // competitor vs the user. Cell values are "engines where cited / engines checked".
  type ShowdownCell = { cited: number; total: number };
  const showdown = new Map<string, Map<string, ShowdownCell>>(); // keywordId → domain → cell
  const userCol = "__user__";
  for (const r of results) {
    if (!showdown.has(r.keywordId)) showdown.set(r.keywordId, new Map());
    const row = showdown.get(r.keywordId)!;

    const cols = [userCol, ...declaredCompetitors];
    for (const col of cols) {
      if (!row.has(col)) row.set(col, { cited: 0, total: 0 });
      row.get(col)!.total += 1;
    }

    // Collect every domain that appeared in this result's citations.
    const citedDomains = new Set<string>(
      ((r.citedUrls as Array<{ domain: string }>) ?? []).map((c) => c.domain),
    );

    if (r.mentioned) row.get(userCol)!.cited += 1;
    for (const comp of declaredCompetitors) {
      if ([...citedDomains].some((d) => d === comp || d.endsWith("." + comp))) {
        row.get(comp)!.cited += 1;
      }
    }
  }

  // Per-competitor totals across all keywords × engines
  const competitorTotals = declaredCompetitors.map((comp) => {
    let cited = 0;
    let total = 0;
    for (const row of showdown.values()) {
      const cell = row.get(comp);
      if (!cell) continue;
      cited += cell.cited;
      total += cell.total;
    }
    return { domain: comp, cited, total };
  });

  const userTotal = { cited: 0, total: 0 };
  for (const row of showdown.values()) {
    const cell = row.get(userCol);
    if (!cell) continue;
    userTotal.cited += cell.cited;
    userTotal.total += cell.total;
  }

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Answer Engine Optimization
          </p>
          <h1 className="font-display text-[40px] mt-3">AEO</h1>
        </div>
        <RunAeoCheckButton
          label={latestRun ? "Run new check" : "Run first check"}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <AeoStatusBanner run={banner} />

      {!latestRun && (
        <div className="rounded-2xl bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            Track whether your domain is cited by <strong>ChatGPT</strong>,{" "}
            <strong>Perplexity</strong>, and <strong>Claude</strong> for your keywords. This is
            the SEO of 2026 — when people ask an AI instead of Google, are you in the answer?
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Configure at least one of <code className="font-mono">PERPLEXITY_API_KEY</code>,{" "}
            <code className="font-mono">ANTHROPIC_API_KEY</code>, or{" "}
            <code className="font-mono">OPENAI_API_KEY</code> in your env, then tap{" "}
            <strong>Run first check</strong>.
          </p>
        </div>
      )}

      {latestRun && latestRun.status === "done" && results.length > 0 && (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label="Overall mention rate"
              value={`${mentionRate}%`}
              subtitle={`${latestRun.mentionedCount ?? 0} / ${latestRun.checkCount ?? 0} checks`}
            />
            <StatTile
              label="Keywords checked"
              value={(latestRun.keywordCount ?? 0).toString()}
              subtitle={`across ${enginesUsed.length} engine${enginesUsed.length > 1 ? "s" : ""}`}
            />
            <StatTile
              label="Cost this run"
              value={latestRun.costUsd ? `$${Number(latestRun.costUsd).toFixed(3)}` : "—"}
              subtitle="LLM API calls"
              muted={!latestRun.costUsd}
            />
          </section>

          {/* Per-engine summary */}
          <section className="rounded-2xl bg-secondary p-6 md:p-8">
            <h2 className="font-display text-2xl md:text-3xl">By engine</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {engineStats.map((s) => {
                const pct = s.total > 0 ? Math.round((s.cited / s.total) * 100) : 0;
                return (
                  <div key={s.engine} className="rounded-[12px] bg-background p-5">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {ENGINE_LABELS[s.engine] ?? s.engine}
                    </div>
                    <div className="mt-3 font-display text-3xl">{pct}%</div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono tabular">
                      {s.cited}/{s.total} citations
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main matrix */}
            <div className="lg:col-span-2 rounded-2xl bg-secondary p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Keyword × engine</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                ✓ = your domain is in the answer's citations. Number = position in the cited list.
              </p>
              <div className="rounded-[12px] bg-background overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Keyword</th>
                      {enginesUsed.map((e) => (
                        <th key={e} className="text-center px-3 py-3 font-medium">
                          {ENGINE_LABELS[e] ?? e}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...matrix.entries()].map(([keywordId, engineMap]) => {
                      const kw = keywordById.get(keywordId);
                      if (!kw) return null;
                      return (
                        <tr key={keywordId} className="border-t border-border">
                          <td className="px-4 py-3 truncate max-w-[280px]" title={kw.query}>
                            {kw.query}
                          </td>
                          {enginesUsed.map((e) => {
                            const r = engineMap.get(e);
                            return (
                              <td key={e} className="px-3 py-3 text-center">
                                <MentionCell result={r} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Side: all citing domains (organic discovery) */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-secondary p-6 md:p-8">
                <h2 className="font-display text-2xl md:text-3xl">All cited domains</h2>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Every domain the LLMs cited, most-to-least frequent. Candidates for your
                  declared competitor list.
                </p>
                {topCompetitors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No citations yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topCompetitors.map(([domain, count]) => {
                      const declared = declaredCompetitors.includes(domain);
                      return (
                        <div
                          key={domain}
                          className="flex items-center gap-3 rounded-[12px] bg-background px-4 py-3"
                        >
                          <div className="flex-1 min-w-0 truncate font-mono tabular text-xs">
                            {domain}
                          </div>
                          {declared && (
                            <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full bg-foreground/10 text-foreground shrink-0">
                              tracked
                            </span>
                          )}
                          <div className="text-xs text-muted-foreground shrink-0">
                            {count} citation{count > 1 ? "s" : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Link
                  href="/dashboard/business"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  Manage tracked competitors <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </section>

          {/* Competitor showdown — against user's declared competitors */}
          {declaredCompetitors.length === 0 ? (
            <section className="rounded-2xl bg-secondary p-6 md:p-8">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Competitor showdown
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">
                Compare AEO vs your competitors
              </h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-xl">
                Add your top 3 competitor domains in your business profile and we'll show how
                often the LLMs cite them vs you — per keyword, per engine.
              </p>
              <Link
                href="/dashboard/business"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-85"
              >
                Add competitors <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </section>
          ) : (
            <section className="space-y-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Competitor showdown
                </div>
                <h2 className="font-display text-2xl md:text-3xl mt-2">You vs your competitors</h2>
              </div>

              {/* Head-to-head summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitorTotals.map((c) => {
                  const youPct =
                    userTotal.total > 0 ? Math.round((userTotal.cited / userTotal.total) * 100) : 0;
                  const theyPct = c.total > 0 ? Math.round((c.cited / c.total) * 100) : 0;
                  const diff = youPct - theyPct;
                  return (
                    <div key={c.domain} className="rounded-2xl bg-secondary p-6">
                      <div className="font-mono tabular text-xs text-muted-foreground truncate">
                        vs {c.domain}
                      </div>
                      <div className="mt-4 flex items-baseline gap-3">
                        <div className="font-display text-4xl">{youPct}%</div>
                        <div className="text-muted-foreground text-sm">you</div>
                      </div>
                      <div className="mt-1 flex items-baseline gap-3">
                        <div className="font-display text-2xl text-muted-foreground">
                          {theyPct}%
                        </div>
                        <div className="text-muted-foreground text-sm">them</div>
                      </div>
                      <div
                        className={`mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase font-medium px-2.5 py-1 rounded-full ${
                          diff > 0
                            ? "bg-[var(--up)]/15 text-[var(--up)]"
                            : diff < 0
                              ? "bg-[var(--down)]/15 text-[var(--down)]"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {diff > 0 ? `+${diff}pp ahead` : diff < 0 ? `${diff}pp behind` : "tied"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Showdown matrix: rows = keywords, columns = [You, Comp1..N] */}
              <div className="rounded-2xl bg-secondary p-6 md:p-8">
                <h3 className="font-display text-xl md:text-2xl">Per-keyword breakdown</h3>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Each cell shows <strong>engines that cited the domain</strong> / engines
                  checked, for that keyword.
                </p>
                <div className="rounded-[12px] bg-background overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Keyword</th>
                        <th className="text-center px-3 py-3 font-medium">You</th>
                        {declaredCompetitors.map((c) => (
                          <th
                            key={c}
                            className="text-center px-3 py-3 font-medium font-mono tabular text-[10px] normal-case max-w-[140px] truncate"
                            title={c}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...showdown.entries()].map(([keywordId, row]) => {
                        const kw = keywordById.get(keywordId);
                        if (!kw) return null;
                        return (
                          <tr key={keywordId} className="border-t border-border">
                            <td className="px-4 py-3 truncate max-w-[280px]" title={kw.query}>
                              {kw.query}
                            </td>
                            <ShowdownTd cell={row.get(userCol)} isUser />
                            {declaredCompetitors.map((c) => (
                              <ShowdownTd key={c} cell={row.get(c)} />
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <Link
            href="/dashboard/keywords"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-wider opacity-70">Next step</div>
                <p className="mt-3 text-lg leading-snug">
                  Not cited for a keyword? Check that page's content — does it answer the
                  question directly in the first 200 words? Does it have a clear, dated byline
                  and a schema.org article block?
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

function ShowdownTd({
  cell,
  isUser,
}: {
  cell: { cited: number; total: number } | undefined;
  isUser?: boolean;
}) {
  if (!cell || cell.total === 0) {
    return (
      <td className="px-3 py-3 text-center">
        <span className="text-muted-foreground text-xs">—</span>
      </td>
    );
  }
  const full = cell.cited === cell.total;
  const none = cell.cited === 0;
  const cls = full
    ? "bg-[var(--up)]/15 text-[var(--up)]"
    : none
      ? "bg-muted text-muted-foreground"
      : "bg-foreground/10 text-foreground";
  return (
    <td className="px-3 py-3 text-center">
      <span
        className={`inline-block text-xs font-mono tabular px-2.5 py-1 rounded-full ${cls} ${
          isUser ? "font-semibold" : ""
        }`}
      >
        {cell.cited}/{cell.total}
      </span>
    </td>
  );
}

function MentionCell({
  result,
}: {
  result:
    | {
        mentioned: boolean;
        position: number | null;
        error: string | null;
      }
    | undefined
    | null;
}) {
  if (!result) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (result.error) {
    return (
      <span
        className="inline-block text-[10px] uppercase font-medium px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
        title={result.error}
      >
        err
      </span>
    );
  }
  if (result.mentioned) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[var(--up)] font-mono tabular text-xs">
        <Sparkles className="h-3 w-3" strokeWidth={2} />#{result.position}
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">✗</span>;
}

function StatTile({
  label,
  value,
  subtitle,
  muted,
}: {
  label: string;
  value: string;
  subtitle?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-secondary p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-4 font-display text-4xl md:text-5xl ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}
