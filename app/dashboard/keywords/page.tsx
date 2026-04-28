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
import { detectKeywordIssues, getKeywordTip } from "@/lib/seo-score";
import type { KeywordData } from "@/lib/seo-score";
import Link from "next/link";
import { Search, ListOrdered } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
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
      <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
        <EmptyState
          icon={ListOrdered}
          title="No keywords tracked yet"
          description={
            sites.length === 0
              ? "Connect Google Search Console first, then add keywords to start monitoring your search positions."
              : "Add keywords to start monitoring your search positions. We'll fetch rankings daily and analyze trends."
          }
          action={
            sites.length > 0 ? (
              <AddKeywordForm />
            ) : (
              <Link
                href="/dashboard/connect-google"
                className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
              >
                Connect GSC
              </Link>
            )
          }
        />
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
        clicks: schema.gscMetrics.clicks,
      })
      .from(schema.gscMetrics)
      .where(
        and(
          eq(schema.gscMetrics.userId, ctx.ownerId),
          gte(schema.gscMetrics.date, cutoff),
        ),
      ),
  ]);

  // Sum GSC impressions + clicks per keyword over the last 30 days
  const gscImpByKw = new Map<string, number>();
  const gscClicksByKw = new Map<string, number>();
  for (const m of gscMetricsRows) {
    gscImpByKw.set(m.keywordId, (gscImpByKw.get(m.keywordId) ?? 0) + m.impressions);
    gscClicksByKw.set(m.keywordId, (gscClicksByKw.get(m.keywordId) ?? 0) + m.clicks);
  }

  // Build Maps for O(1) lookups instead of O(keywords × positions) filtering
  const positionsByKeyword = new Map<string, typeof positions>();
  for (const p of positions) {
    let arr = positionsByKeyword.get(p.keywordId);
    if (!arr) {
      arr = [];
      positionsByKeyword.set(p.keywordId, arr);
    }
    arr.push(p);
  }
  const compsByKeyword = new Map<string, typeof competitorPositions>();
  for (const c of competitorPositions) {
    let arr = compsByKeyword.get(c.keywordId);
    if (!arr) {
      arr = [];
      compsByKeyword.set(c.keywordId, arr);
    }
    arr.push(c);
  }

  // Build per-keyword latest + delta
  const rows = keywords
    .filter((k) => !k.removedAt)
    .map((k) => {
      const kPos = (positionsByKeyword.get(k.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      const latest = kPos.at(-1);
      const prev = kPos.at(-2);
      const weekAgo = kPos.at(-8);

      // Best (lowest = better) competitor position for this keyword in latest fetch.
      const compsLatest = compsByKeyword.get(k.id) ?? [];
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
        gscClicks: gscClicksByKw.get(k.id) ?? 0,
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

  // ── Intelligence summary computations ──────────────────────────
  const top3Count = rows.filter((r) => r.position != null && r.position <= 3).length;
  const strikingCount = rows.filter((r) => r.position != null && r.position >= 4 && r.position <= 10).length;
  const droppingCount = rows.filter(
    (r) => r.position != null && r.delta7d != null && r.delta7d < 0 && Math.abs(r.delta7d) >= 3,
  ).length;
  const quickWinCount = rows.filter(
    (r) => r.position != null && r.position >= 11 && r.position <= 20 && r.gscImpressions > 100,
  ).length;
  const totalActive = rows.length;

  // Build KeywordData array for seo-score functions
  const keywordDataArray: KeywordData[] = rows.map((r) => ({
    id: r.id,
    query: r.keyword,
    latestPosition: r.position,
    previousPosition: r.delta1d != null && r.position != null ? r.position + r.delta1d : null,
    weekAgoPosition: r.delta7d != null && r.position != null ? r.position + r.delta7d : null,
    impressions28d: r.gscImpressions,
    clicks28d: r.gscClicks,
    intentStage: r.intentStage != null ? Number(r.intentStage) : null,
  }));

  const keywordIssues = detectKeywordIssues(keywordDataArray);
  const topIssues = keywordIssues.slice(0, 3);

  // Build a map from row id to tip for per-row rendering
  const tipByKeywordId = new Map<string, ReturnType<typeof getKeywordTip>>();
  for (const kd of keywordDataArray) {
    tipByKeywordId.set(kd.id, getKeywordTip(kd));
  }

  // Best opportunity: highest-impression keyword in positions 4-10
  const bestOpportunity = rows
    .filter((r) => r.position != null && r.position >= 4 && r.position <= 10)
    .sort((a, b) => b.gscImpressions - a.gscImpressions)[0] ?? null;

  const severityColor: Record<string, string> = {
    high: "#F87171",
    medium: "#FBBF24",
    low: "#A855F7",
  };

  const tipColorClass: Record<string, string> = {
    green: "text-[var(--up)]",
    yellow: "text-yellow-400",
    red: "text-[var(--down)]",
    purple: "text-primary",
    gray: "text-muted-foreground",
  };

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">rank tracking</p>
          <h1 className="font-display text-[40px] mt-2">
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

      {/* ── Keyword Health Summary ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "top 3", value: top3Count, color: "#34D399" },
          { label: "striking distance", value: strikingCount, subtitle: "pos 4-10", color: "#A855F7" },
          { label: "dropping", value: droppingCount, color: "#F87171" },
          { label: "quick wins", value: quickWinCount, subtitle: "pos 11-20, high impr", color: "#A855F7" },
          { label: "total tracked", value: totalActive, color: "#FFFFFF" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl px-4 py-3">
            <div className="font-mono text-[10px] text-muted-foreground">
              {stat.label}
              {stat.subtitle && (
                <span className="ml-1 opacity-60">({stat.subtitle})</span>
              )}
            </div>
            <div
              className="font-mono text-2xl font-semibold tabular-nums mt-0.5"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Top Issues ────────────────────────────────────────── */}
      {topIssues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {topIssues.map((issue, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-4"
              style={{ borderLeft: `3px solid ${severityColor[issue.severity] ?? "#A855F7"}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: severityColor[issue.severity] ?? "#A855F7" }}
                />
                <span className="font-mono text-[11px] font-medium truncate">
                  {issue.title}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {issue.description}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                {issue.impact}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Best Opportunity ──────────────────────────────────── */}
      {bestOpportunity && bestOpportunity.gscImpressions > 50 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-5">
          <p className="text-sm">
            <span className="mr-1.5">💡</span>
            <span className="font-medium">Best opportunity:</span>{" "}
            <span className="font-mono text-xs">{bestOpportunity.keyword}</span> at{" "}
            <span className="font-mono text-xs font-semibold">#{bestOpportunity.position}</span> with{" "}
            <span className="font-mono text-xs font-semibold tabular-nums">
              {bestOpportunity.gscImpressions.toLocaleString()}
            </span>{" "}
            monthly impressions. Push to top 3 to capture 3x more clicks.
          </p>
        </div>
      )}

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
              <th className="text-left px-3 py-2 font-mono text-[9px] text-muted-foreground font-normal">Tip</th>
              <th className="px-4 py-2 w-8" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
                <td className="px-3 py-2.5">
                  {(() => {
                    const tip = tipByKeywordId.get(r.id);
                    if (!tip) return null;
                    return (
                      <span className={`font-mono text-[11px] leading-snug ${tipColorClass[tip.color] ?? "text-muted-foreground"}`}>
                        {tip.text}
                      </span>
                    );
                  })()}
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
