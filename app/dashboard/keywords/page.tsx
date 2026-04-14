import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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
import { classifyCompetitorUrl } from "@/lib/competitor-threat";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const t = tenantDb(session.user.id);
  const keywords = await t.selectKeywords();
  const sites = await t.selectSites();

  if (keywords.length === 0) {
    return (
      <div className="px-8 py-12">
        <div className="max-w-md border border-border border-dashed rounded-md p-8 bg-card">
          <h2 className="text-base font-semibold">Start tracking your first keyword</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {sites.length === 0
              ? "Connect Google Search Console first to register your site."
              : "Add a keyword manually, or re-connect GSC to auto-import your top 20 queries."}
          </p>
          {sites.length > 0 && (
            <div className="mt-5">
              <AddKeywordForm />
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground font-mono tabular">
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

  const [positions, competitorPositions] = await Promise.all([
    db
      .select()
      .from(schema.positions)
      .where(and(eq(schema.positions.userId, session.user.id), gte(schema.positions.date, cutoff))),
    db
      .select()
      .from(schema.competitorPositions)
      .where(
        and(
          eq(schema.competitorPositions.userId, session.user.id),
          gte(schema.competitorPositions.date, cutoff),
        ),
      )
      .orderBy(desc(schema.competitorPositions.date)),
  ]);

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
        history: kPos.slice(-30).map((p) => p.position),
      };
    });

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
            {rows.length} tracked. Data lags 0-1 day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddKeywordForm />
          {unclassifiedCount > 0 && <ClassifyAllButton />}
          <FetchNowButton />
        </div>
      </header>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Keyword</th>
              <th className="text-left px-3 py-2 font-medium w-12">Intent</th>
              <th className="text-left px-3 py-2 font-medium">Diagnostic</th>
              <th className="text-right px-4 py-2 font-medium">Position</th>
              <th className="text-right px-4 py-2 font-medium">1d Δ</th>
              <th className="text-right px-4 py-2 font-medium">7d Δ</th>
              <th className="text-right px-4 py-2 font-medium">Best comp</th>
              <th className="text-left px-4 py-2 font-medium">Country</th>
              <th className="px-4 py-2 w-8" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-4 py-2.5 truncate max-w-xs" title={r.keyword}>
                  {r.keyword}
                </td>
                <td className="px-3 py-2.5">
                  <IntentStageBadge stage={r.intentStage} />
                </td>
                <td className="px-3 py-2.5">
                  <DiagnosticBadge tag={r.diagnostic} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular">
                  {r.position ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right"><RankDelta value={r.delta1d} /></td>
                <td className="px-4 py-2.5 text-right"><RankDelta value={r.delta7d} /></td>
                <td className="px-4 py-2.5 text-right font-mono tabular text-xs">
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
                <td className="px-4 py-2.5 text-muted-foreground uppercase text-xs font-mono tabular">
                  {r.country}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <RemoveKeywordButton keywordId={r.id} />
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
