import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, desc, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { GenerateBriefButton } from "@/components/generate-brief-button";
import { BriefStatusBanner } from "@/components/brief-status-banner";
import { getUserPlan } from "@/lib/billing-helpers";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { ShareLinkButton } from "@/components/share-link-button";
import { BriefPdfButton } from "@/components/brief-pdf-button";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const [latest] = await t.selectLatestBrief();
  const positionsCount = await db
    .select({ c: schema.positions.id })
    .from(schema.positions)
    .where(eq(schema.positions.userId, ctx.ownerId))
    .limit(1);
  const hasData = positionsCount.length > 0;

  const [latestBriefRun] = await db
    .select()
    .from(schema.briefRuns)
    .where(eq(schema.briefRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.briefRuns.queuedAt))
    .limit(1);

  const briefRunBanner = latestBriefRun
    ? {
        id: latestBriefRun.id,
        source: latestBriefRun.source,
        status: latestBriefRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestBriefRun.queuedAt.toISOString(),
        startedAt: latestBriefRun.startedAt?.toISOString() ?? null,
        finishedAt: latestBriefRun.finishedAt?.toISOString() ?? null,
        error: latestBriefRun.error,
      }
    : null;

  const plan = await getUserPlan(ctx.ownerId);

  // Query latest SEO score for priorities section
  const [latestScore] = await db
    .select()
    .from(schema.seoScores)
    .where(eq(schema.seoScores.userId, ctx.ownerId))
    .orderBy(desc(schema.seoScores.computedAt))
    .limit(1);

  // Query last 4 scores for trend
  const scoreTrend = await db
    .select({ score: schema.seoScores.score, computedAt: schema.seoScores.computedAt })
    .from(schema.seoScores)
    .where(eq(schema.seoScores.userId, ctx.ownerId))
    .orderBy(desc(schema.seoScores.computedAt))
    .limit(4);

  // Build top 3 priorities from seoScore issues
  const topIssues = latestScore?.issues
    ? [...latestScore.issues]
        .sort((a, b) => {
          const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
        })
        .slice(0, 3)
    : [];

  if (!latest) {
    return (
      <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
        <BriefStatusBanner run={briefRunBanner} />
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Weekly</p>
          <h1 className="font-display text-[40px] mt-2">Brief</h1>
        </header>
        {plan === "free" ? (
          <UpgradePrompt
            feature="Weekly AI Brief"
            description="Get a weekly AI-generated brief analyzing your keyword movements, top movers, and actionable tickets. Upgrade to Pro to unlock."
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No brief generated yet"
            description={
              hasData
                ? "Once you have position data, generate your first AI brief. It analyzes your SEO and creates a weekly action plan."
                : "No data yet. Run a SERP fetch first, then generate the brief."
            }
            action={
              hasData ? (
                <GenerateBriefButton
                  variant="default"
                  activeStatus={(latestBriefRun?.status as any) ?? null}
                />
              ) : undefined
            }
          />
        )}
      </div>
    );
  }

  const topMovers = latest.topMovers as Array<{
    keyword: string;
    delta: number;
    probable_cause: string;
    confidence: number;
  }>;
  const tickets = latest.tickets as Array<{
    priority: "high" | "medium" | "low";
    action: string;
    target: string;
    why: string;
    estimated_effort_min: number;
  }>;
  const warnings = (latest.warnings as string[]) ?? [];

  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <BriefStatusBanner run={briefRunBanner} />

      {/* Hero header */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground font-mono tabular">
            Week of {latest.periodStart} → {latest.periodEnd}
          </p>
          <h1 className="font-display text-[40px] mt-2">Weekly brief</h1>
          <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted-foreground">
            {latest.summary}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <BriefPdfButton briefId={latest.id} />
          <ShareLinkButton resourceType="brief" resourceId={latest.id} />
          <GenerateBriefButton
            label="Regenerate"
            activeStatus={(latestBriefRun?.status as any) ?? null}
          />
        </div>
      </header>

      {/* This week's 3 priorities */}
      {topIssues.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] text-muted-foreground mb-3">this week&apos;s priorities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topIssues.map((issue, i) => (
              <div key={i} className="rounded-2xl bg-card p-5 flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-xs font-semibold">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{issue.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {issue.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Health score trend */}
      {scoreTrend.length >= 2 && (
        <section className="rounded-2xl bg-card p-5">
          <div className="font-mono text-[10px] text-muted-foreground mb-3">health score trend</div>
          <div className="flex items-end gap-3 h-16">
            {[...scoreTrend].reverse().map((s, i) => {
              const height = Math.max(8, (s.score / 100) * 64);
              const isLatest = i === scoreTrend.length - 1;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className={`font-mono text-[10px] tabular-nums ${isLatest ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.score}
                  </span>
                  <div
                    className={`w-8 rounded-t-md ${isLatest ? "bg-primary" : "bg-primary/30"}`}
                    style={{ height: `${height}px` }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Movers analysed" value={topMovers.length.toString()} />
        <StatTile label="Actions queued" value={tickets.length.toString()} />
        <StatTile
          label="High priority"
          value={highPriorityCount.toString()}
          muted={highPriorityCount === 0}
        />
      </section>

      {/* Main grid: 2/3 actions + 1/3 movers */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions — primary column */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-card p-6 md:p-8">
            <div className="mb-6">
              <div className="font-mono text-[10px] text-muted-foreground">
                this week
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">Actions</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {tickets.length} ticket{tickets.length > 1 ? "s" : ""} generated from the movers
                above.
              </p>
            </div>
            <div className="space-y-2">
              {tickets.map((ticket, i) => (
                <div key={i} className="rounded-[12px] bg-background p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 accent-foreground"
                      aria-label={`Mark ticket as done: ${ticket.action}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PriorityPill priority={ticket.priority} />
                        <span className="text-sm font-medium">{ticket.action}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono tabular">
                        {ticket.target} · ~{ticket.estimated_effort_min}min
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {ticket.why}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movers — side column */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-card p-6 md:p-8">
            <div className="mb-6">
              <div className="font-mono text-[10px] text-muted-foreground">
                this week
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">Top movers</h2>
            </div>
            <div className="space-y-2">
              {topMovers.map((m) => (
                <div
                  key={m.keyword}
                  className="rounded-[12px] bg-background p-3 flex items-start gap-3"
                >
                  <div
                    className={`font-mono tabular text-sm w-12 text-right shrink-0 ${
                      m.delta > 0
                        ? "text-[var(--up)]"
                        : m.delta < 0
                          ? "text-[var(--down)]"
                          : "text-muted-foreground"
                    }`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" title={m.keyword}>
                      {m.keyword}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">
                      {m.probable_cause}
                    </div>
                  </div>
                  {m.confidence < 0.5 && (
                    <Badge variant="outline" className="shrink-0 text-[10px] rounded-full">
                      hypothèse
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-2xl border border-[var(--down)]/30 bg-[var(--down)]/5 p-6">
              <h2 className="font-mono text-[10px] text-[var(--down)] mb-3">
                warnings
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl bg-card p-6">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`mt-4 font-display text-4xl md:text-5xl ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-[var(--down)]/15 text-[var(--down)]",
    medium: "bg-foreground/10 text-foreground",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase font-medium px-2.5 py-1 rounded-full ${map[priority]}`}
    >
      {priority}
    </span>
  );
}
