import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, and, gte, desc } from "drizzle-orm";
import { RankDelta } from "@/components/rank-delta";
import { AddKeywordForm } from "@/components/add-keyword-form";
import { FetchNowButton } from "@/components/fetch-now-button";
import { RemoveKeywordButton } from "@/components/remove-keyword-button";
import { IntentStageBadge } from "@/components/intent-stage-badge";
import { ClassifyAllButton } from "@/components/classify-all-button";
import { DiagnosticBadge } from "@/components/diagnostic-badge";
import { computeDiagnostic } from "@/lib/diagnostics";
import { ThreatBadge } from "@/components/threat-badge";
import { PositionSparkline } from "@/components/position-sparkline";
import { PositionHeatmap } from "@/components/position-heatmap";
import { classifyCompetitorUrl } from "@/lib/competitor-threat";
import Link from "next/link";
import { Search } from "lucide-react";
import { KeywordsFilterBar } from "@/components/keywords-filter-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { applyFilters, parseFiltersFromSearchParams } from "@/lib/keyword-filters";
import { listGroups, listAllMemberships } from "@/lib/actions/keyword-groups";
import { KeywordGroupBar } from "@/components/keyword-group-bar";
import { KeywordGroupPicker } from "@/components/keyword-group-picker";

export const dynamic = "force-dynamic";

export default async function KeywordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const keywords = await t.selectKeywords();
  const sites = await t.selectSites();
  const sp = await searchParams;
  // Coerce searchParams record into something that has a get(key) like URLSearchParams
  const filters = parseFiltersFromSearchParams({
    get: (k: string) => {
      const v = sp[k];
      return Array.isArray(v) ? v[0] ?? null : v ?? null;
    },
  });

  const activeGroupId = typeof sp.group === "string" ? sp.group : null;

  // Load groups and memberships
  const [groups, memberships] = await Promise.all([
    listGroups(),
    listAllMemberships(),
  ]);

  // Build lookup: keywordId -> groupIds
  const keywordGroupMap = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = keywordGroupMap.get(m.keywordId) ?? [];
    arr.push(m.groupId);
    keywordGroupMap.set(m.keywordId, arr);
  }

  // Set of keyword IDs in the active group (for filtering)
  const activeGroupKeywordIds = activeGroupId
    ? new Set(memberships.filter((m) => m.groupId === activeGroupId).map((m) => m.keywordId))
    : null;

  if (keywords.length === 0) {
    return (
      <div className="px-8 py-12">
        <div className="bg-card rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {sites.length === 0
              ? "Connect Google Search Console first to register your site."
              : "Add a keyword manually, or re-connect GSC to auto-import your top 20 queries."}
          </p>
          {sites.length > 0 && (
            <div className="mt-4">
              <AddKeywordForm />
            </div>
          )}
          <div className="mt-4 font-mono text-[10px] text-muted-foreground">
            Example: &quot;rank tracker alternative&quot;
          </div>
        </div>
      </div>
    );
  }

  // Load recent positions for all keywords in one query
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 30);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const [positions, competitorPositions, gscMetricsRows] = await Promise.all([
    db
      .select()
      .from(schema.positions)
      .where(and(eq(schema.positions.userId, ctx.ownerId), gte(schema.positions.date, cutoff))),
    db
      .select()
      .from(schema.competitorPositions)
      .where(
        and(
          eq(schema.competitorPositions.userId, ctx.ownerId),
          gte(schema.competitorPositions.date, cutoff),
        ),
      )
      .orderBy(desc(schema.competitorPositions.date)),
    db
      .select({
        keywordId: schema.gscMetrics.keywordId,
        impressions: schema.gscMetrics.impressions,
      })
      .from(schema.gscMetrics)
      .where(
        and(
          eq(schema.gscMetrics.userId, ctx.ownerId),
          gte(schema.gscMetrics.date, cutoff),
        ),
      ),
  ]);

  // Sum GSC impressions per keyword over the last 30 days
  const gscImpByKw = new Map<string, number>();
  for (const m of gscMetricsRows) {
    gscImpByKw.set(m.keywordId, (gscImpByKw.get(m.keywordId) ?? 0) + m.impressions);
  }

  // Build per-keyword latest + delta
  const rows = keywords
    .filter((k) => !k.removedAt)
    .map((k) => {
      const kPos = positions.filter((p) => p.keywordId === k.id).sort((a, b) => a.date.localeCompare(b.date));
      const latest = kPos.at(-1);
      const prev = kPos.at(-2);
      const weekAgo = kPos.at(-8);

      // Best (lowest = better) competitor position for this keyword in latest fetch.
      const compsLatest = competitorPositions.filter((c) => c.keywordId === k.id);
      const latestDate = latest?.date;
      const compsToday = latestDate
        ? compsLatest.filter((c) => c.date === latestDate)
        : [];
      const ranked = compsToday.filter((c) => c.position != null);
      const best = ranked.length
        ? ranked.reduce((a, b) => ((a.position! <= b.position!) ? a : b))
        : null;
      const bestThreat = best?.url ? classifyCompetitorUrl(best.url) : null;

      const diagnostic = computeDiagnostic(
        kPos.map((p) => ({ date: p.date, position: p.position })),
      );

      return {
        id: k.id,
        keyword: k.query,
        country: k.country,
        intentStage: k.intentStage,
        diagnostic,
        position: latest?.position ?? null,
        delta1d: latest && prev && latest.position && prev.position ? prev.position - latest.position : null,
        delta7d: latest && weekAgo && latest.position && weekAgo.position ? weekAgo.position - latest.position : null,
        bestCompPosition: best?.position ?? null,
        bestCompDomain: best?.competitorDomain ?? null,
        bestCompThreat: bestThreat,
        compCount: ranked.length,
        gscImpressions: gscImpByKw.get(k.id) ?? 0,
        sparkline7d: kPos.slice(-7).map((p) => p.position).filter((p): p is number => p != null),
        heatmap7d: (() => {
          const last8 = kPos.slice(-8);
          const deltas: Array<number | null> = [];
          for (let i = 1; i < 8; i++) {
            const curr = last8[i]?.position ?? null;
            const prev = last8[i - 1]?.position ?? null;
            if (curr != null && prev != null) {
              // Lower position = better, so positive delta = improvement
              deltas.push(prev - curr);
            } else {
              deltas.push(null);
            }
          }
          // Pad from the front if we have fewer than 7 deltas
          while (deltas.length < 7) deltas.unshift(null);
          return deltas.slice(-7);
        })(),
        history: kPos.slice(-30).map((p) => p.position),
      };
    });

  const filteredByFilters = applyFilters(rows, filters);
  const filteredRows = activeGroupKeywordIds
    ? filteredByFilters.filter((r) => activeGroupKeywordIds.has(r.id))
    : filteredByFilters;

  const unclassifiedCount = rows.filter((r) => r.intentStage == null).length;

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Keywords{" "}
            {sites[0] && (
              <span className="text-muted-foreground font-normal text-base font-mono tabular">
                · {sites[0].domain}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} tracked · {filteredRows.length} shown. Data lags 0-1 day.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/keywords/discover"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/40"
          >
            <Search className="h-3 w-3" strokeWidth={1.5} />
            Discover keywords
          </Link>
          <AddKeywordForm />
          {unclassifiedCount > 0 && <ClassifyAllButton />}
          <FetchNowButton />
          <ExportCsvButton type="keywords" />
        </div>
      </header>

      <div className="mb-4">
        <KeywordGroupBar groups={groups} activeGroupId={activeGroupId} />
      </div>

      <div className="mb-6">
        <KeywordsFilterBar totalCount={rows.length} filteredCount={filteredRows.length} />
      </div>

      <div className="bg-card rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">Keyword</th>
              <th className="text-left px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal w-12">Intent</th>
              <th className="text-left px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal">Diagnostic</th>
              <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">Position</th>
              <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">1d Δ</th>
              <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">7d Δ</th>
              <th className="px-2 py-2 font-mono text-[9px] text-muted-foreground font-normal text-center">7d</th>
              <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">Impr 30d</th>
              <th className="text-right px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">Best comp</th>
              <th className="text-left px-4 py-2 font-mono text-[9px] text-muted-foreground font-normal">Country</th>
              <th className="px-4 py-2 w-8" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No keywords match these filters. Click <strong>Reset</strong> above to clear.
                </td>
              </tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                <td className="px-4 py-2.5 text-xs max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/keywords/${r.id}`}
                      className="hover:underline truncate"
                      title={r.keyword}
                    >
                      {r.keyword}
                    </Link>
                    {(keywordGroupMap.get(r.id) ?? []).map((gId) => {
                      const g = groups.find((gr) => gr.id === gId);
                      if (!g) return null;
                      return (
                        <span
                          key={gId}
                          className="inline-flex h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: g.color ?? "#A855F7" }}
                          title={g.name}
                        />
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <IntentStageBadge stage={r.intentStage} />
                </td>
                <td className="px-3 py-2.5">
                  <DiagnosticBadge tag={r.diagnostic} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                  {r.position ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right"><RankDelta value={r.delta1d} /></td>
                <td className="px-4 py-2.5 text-right"><RankDelta value={r.delta7d} /></td>
                <td className="px-2 py-2.5 text-center">
                  <PositionHeatmap changes={r.heatmap7d} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {r.gscImpressions > 0 ? r.gscImpressions.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                  {r.bestCompPosition != null ? (
                    <span
                      className="inline-flex items-center gap-1.5 justify-end"
                      title={`${r.bestCompDomain} · ${r.compCount} competitor(s) tracked${
                        r.bestCompThreat ? ` · ${r.bestCompThreat.reason}` : ""
                      }`}
                    >
                      {r.bestCompThreat && <ThreatBadge tier={r.bestCompThreat.tier} />}
                      <span
                        className={
                          r.position != null && r.bestCompPosition < r.position
                            ? "text-[var(--down)]"
                            : "text-muted-foreground"
                        }
                      >
                        #{r.bestCompPosition}
                      </span>
                      <span className="text-muted-foreground/60">
                        {r.bestCompDomain && r.bestCompDomain.length > 12
                          ? r.bestCompDomain.slice(0, 12) + "…"
                          : r.bestCompDomain}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono tabular-nums">
                  {r.country.toUpperCase()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <KeywordGroupPicker
                      keywordId={r.id}
                      groups={groups}
                      memberOf={keywordGroupMap.get(r.id) ?? []}
                    />
                    <RemoveKeywordButton keywordId={r.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.history.length < 28) && (
        <div className="mt-4 inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-200 px-3 py-1.5 rounded text-xs">
          Collecting data. Charts partial until 4 weeks of history.
        </div>
      )}
    </div>
  );
}
