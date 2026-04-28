import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, tenantDb, schema } from "@/db/client";
import { and, eq, gte } from "drizzle-orm";
import { ArrowRight, ExternalLink, FileText, TrendingDown } from "lucide-react";
import {
  detectPageRefreshCandidates,
  detectKeywordRefreshCandidates,
  type RefreshCandidate,
} from "@/lib/refresh-radar";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 56; // 8 weeks — enough signal for a stable linear trend

export default async function RefreshPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const [pageRows, kwMetrics, keywords] = await Promise.all([
    db
      .select()
      .from(schema.gscPageMetrics)
      .where(
        and(
          eq(schema.gscPageMetrics.userId, ctx.ownerId),
          gte(schema.gscPageMetrics.date, cutoffStr),
        ),
      )
      .limit(50000),
    db
      .select()
      .from(schema.gscMetrics)
      .where(
        and(
          eq(schema.gscMetrics.userId, ctx.ownerId),
          gte(schema.gscMetrics.date, cutoffStr),
        ),
      )
      .limit(50000),
    t.selectKeywords(),
  ]);

  // Group page data by URL
  const pagesByUrl = new Map<
    string,
    Array<{ date: string; clicks: number; impressions: number; position: number }>
  >();
  for (const r of pageRows) {
    if (!pagesByUrl.has(r.url)) pagesByUrl.set(r.url, []);
    pagesByUrl.get(r.url)!.push({
      date: r.date,
      clicks: r.clicks,
      impressions: r.impressions,
      position: Number(r.position),
    });
  }

  const pageSeries = [...pagesByUrl.entries()].map(([url, points]) => ({ url, points }));
  const pageCandidates = detectPageRefreshCandidates(pageSeries);

  // Group keyword GSC metrics by keyword
  const kwByKeyword = new Map<
    string,
    Array<{ date: string; position: number; clicks: number }>
  >();
  for (const r of kwMetrics) {
    if (!kwByKeyword.has(r.keywordId)) kwByKeyword.set(r.keywordId, []);
    kwByKeyword.get(r.keywordId)!.push({
      date: r.date,
      position: Number(r.gscPosition),
      clicks: r.clicks,
    });
  }
  const kwNameById = new Map(keywords.map((k) => [k.id, k.query]));
  const keywordSeries = [...kwByKeyword.entries()].map(([keywordId, points]) => ({
    keywordId,
    keyword: kwNameById.get(keywordId) ?? keywordId,
    points,
  }));
  const keywordCandidates = detectKeywordRefreshCandidates(keywordSeries);

  const allCandidates = [...pageCandidates, ...keywordCandidates];
  const high = allCandidates.filter((c) => c.severity === "high").length;
  const medium = allCandidates.filter((c) => c.severity === "medium").length;

  const hasData = pageRows.length > 0 || kwMetrics.length > 0;

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          Content refresh radar · last {WINDOW_DAYS} days
        </p>
        <h1 className="font-display text-[40px] mt-3">Refresh</h1>
      </header>

      {!hasData && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            Pull GSC history first — the radar needs at least 3 weeks of daily data to fit a
            trend.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Pull GSC history <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {hasData && allCandidates.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            <strong>Nothing declining.</strong> Every page and keyword we have enough data on
            is flat or improving.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Re-run the radar weekly. Trends appear over 4+ weeks.
          </p>
        </div>
      )}

      {hasData && allCandidates.length > 0 && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label="High severity"
              value={high.toString()}
              subtitle="strong downward trend + volume"
              accent={high > 0 ? "down" : undefined}
            />
            <StatTile
              label="Medium"
              value={medium.toString()}
              subtitle="moderate decline — monitor"
            />
            <StatTile
              label="Total"
              value={allCandidates.length.toString()}
              subtitle={`${pageCandidates.length} pages · ${keywordCandidates.length} keywords`}
              muted
            />
          </section>

          {pageCandidates.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl md:text-3xl">Pages losing ground</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Indexed pages whose clicks or position has been drifting downward.
                </p>
              </div>
              {pageCandidates.slice(0, 30).map((c) => (
                <CandidateCard key={`page-${c.id}`} candidate={c} />
              ))}
            </section>
          )}

          {keywordCandidates.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl md:text-3xl">Keywords slipping</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Tracked keywords whose GSC position is worsening week-over-week.
                </p>
              </div>
              {keywordCandidates.slice(0, 30).map((c) => (
                <CandidateCard key={`kw-${c.id}`} candidate={c} />
              ))}
            </section>
          )}

          <Link
            href="/dashboard/chat"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] opacity-70">next step</div>
                <p className="mt-3 text-lg leading-snug">
                  Pick the highest-severity page, open it, skim the content. If it's more than
                  6 months old and answers the query thinly — refresh now. Ask chat for a
                  content-brief based refresh plan.
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

function CandidateCard({ candidate }: { candidate: RefreshCandidate }) {
  const displayLabel = candidate.kind === "page" ? safePath(candidate.label) : candidate.label;
  const href =
    candidate.kind === "page"
      ? candidate.label
      : `/dashboard/keywords/${candidate.id}`;
  return (
    <div className="rounded-2xl bg-card p-5 md:p-6 flex items-start gap-4">
      <div className="h-10 w-10 rounded-full bg-[var(--down)]/15 text-[var(--down)] flex items-center justify-center shrink-0">
        <TrendingDown className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityPill severity={candidate.severity} />
          <span className="font-mono text-[10px] text-muted-foreground">
            {candidate.kind === "page" ? "page" : "keyword"}
          </span>
          <span className="font-mono tabular text-xs text-muted-foreground">
            {candidate.firstDate} → {candidate.lastDate}
          </span>
        </div>
        <h3 className="font-display text-lg md:text-xl mt-3 break-words">{displayLabel}</h3>
        <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground flex-wrap font-mono tabular">
          <span>
            <span className="text-foreground">{candidate.totals.clicks.toLocaleString()}</span>{" "}
            clicks
          </span>
          {candidate.kind === "page" && (
            <span>
              <span className="text-foreground">
                {candidate.totals.impressions.toLocaleString()}
              </span>{" "}
              impr.
            </span>
          )}
          <span>
            avg pos <span className="text-foreground">{candidate.totals.avgPosition}</span>
          </span>
          <span className="text-[var(--down)]">
            {candidate.kind === "page" ? "clicks" : "position"} trend{" "}
            {candidate.weeklyDelta > 0
              ? `+${candidate.weeklyDelta.toFixed(1)}`
              : candidate.weeklyDelta.toFixed(1)}
            /week
          </span>
        </div>
        <a
          href={candidate.kind === "page" ? href : undefined}
          target={candidate.kind === "page" ? "_blank" : undefined}
          rel={candidate.kind === "page" ? "noreferrer noopener" : undefined}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono tabular text-muted-foreground hover:text-foreground hover:underline truncate max-w-full"
          title={candidate.label}
        >
          <span className="truncate">{displayLabel}</span>
          {candidate.kind === "page" ? (
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
          ) : (
            <FileText className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
          )}
        </a>
      </div>
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
      className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${map[severity]}`}
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
    <div className="rounded-2xl bg-card p-6">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-4 font-display text-3xl md:text-4xl ${valueColor}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}
