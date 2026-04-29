import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { RunAuditButton } from "@/components/run-audit-button";
import { AuditStatusBanner } from "@/components/audit-status-banner";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ShareLinkButton } from "@/components/share-link-button";
import { Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-[var(--down)]/10 text-[var(--down)]",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  low: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
};

export default async function AuditPage() {
  const ctx = await resolveAccountContext();
  const lng = await getLocale();
  const i = locale[lng];

  const [latestRun] = await db
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.auditRuns.queuedAt))
    .limit(1);

  const findings = latestRun
    ? await db
        .select()
        .from(schema.auditFindings)
        .where(eq(schema.auditFindings.runId, latestRun.id))
        .orderBy(desc(schema.auditFindings.severity))
    : [];

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
        pagesCrawled: latestRun.pagesCrawled,
        findingsCount: latestRun.findingsCount,
        highSeverityCount: latestRun.highSeverityCount,
        error: latestRun.error,
      }
    : null;

  let synthesis: {
    summary: string;
    top_actions: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      target_url: string | null;
      why: string;
      estimated_effort_min: number;
    }>;
  } | null = null;

  if (latestRun?.aiSummary) {
    try {
      synthesis = JSON.parse(latestRun.aiSummary);
    } catch {}
  }

  // Query previous completed audit for progress tracking
  const completedRuns = await db
    .select()
    .from(schema.auditRuns)
    .where(and(eq(schema.auditRuns.userId, ctx.ownerId), eq(schema.auditRuns.status, "done")))
    .orderBy(desc(schema.auditRuns.finishedAt))
    .limit(2);

  let issuesFixedSinceLastAudit: number | null = null;
  if (completedRuns.length === 2) {
    const prevCount = completedRuns[1].findingsCount ?? 0;
    const currCount = completedRuns[0].findingsCount ?? 0;
    issuesFixedSinceLastAudit = prevCount - currCount;
  }

  // Build "Fix these first" top 3 high-severity findings with impact estimates
  const highFindings = findings.filter((f) => f.severity === "high");

  // Group high findings by checkKey to aggregate counts
  const highByCheck = new Map<string, { count: number; message: string; checkKey: string }>();
  for (const f of highFindings) {
    const existing = highByCheck.get(f.checkKey);
    if (existing) {
      existing.count++;
    } else {
      highByCheck.set(f.checkKey, { count: 1, message: f.message, checkKey: f.checkKey });
    }
  }
  const topFixFirst = Array.from(highByCheck.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Group findings by URL for the detail table
  const byUrl = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, []);
    byUrl.get(f.url)!.push(f);
  }

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{i.headerKicker}</p>
          <h1 className="font-display text-[40px] mt-2">{i.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {latestRun && (
            <ShareLinkButton resourceType="audit" resourceId={latestRun.id} />
          )}
          <ExportCsvButton type="audit" />
          <RunAuditButton
            label={latestRun ? i.runNewAudit : i.runFirstAudit}
            activeStatus={(latestRun?.status as any) ?? null}
          />
        </div>
      </header>

      <AuditStatusBanner run={banner} />

      {/* Actionable intelligence summary */}
      {findings.length > 0 && (topFixFirst.length > 0 || issuesFixedSinceLastAudit !== null) && (
        <section className="space-y-4">
          {issuesFixedSinceLastAudit !== null && (
            <div className="rounded-2xl bg-card p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-2xl font-semibold tabular-nums ${
                    issuesFixedSinceLastAudit > 0
                      ? "text-[var(--up)]"
                      : issuesFixedSinceLastAudit < 0
                        ? "text-[var(--down)]"
                        : "text-muted-foreground"
                  }`}
                >
                  {issuesFixedSinceLastAudit > 0
                    ? i.issuesFixed(issuesFixedSinceLastAudit)
                    : issuesFixedSinceLastAudit < 0
                      ? i.newIssues(Math.abs(issuesFixedSinceLastAudit))
                      : i.noChange}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{i.sinceLastAudit}</span>
              </div>
            </div>
          )}

          {topFixFirst.length > 0 && (
            <div>
              <h2 className="font-mono text-[10px] text-muted-foreground mb-3">{i.fixFirst}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topFixFirst.map((item, idx) => {
                  const borderColor =
                    idx === 0 ? "border-l-[var(--down)]" : idx === 1 ? "border-l-yellow-500" : "border-l-[var(--primary)]";
                  const impact =
                    i.impactEstimates[item.checkKey] ?? i.defaultImpact(item.count);
                  return (
                    <div
                      key={item.checkKey}
                      className={`rounded-2xl bg-card p-4 border-l-[3px] ${borderColor}`}
                    >
                      <div className="text-sm font-medium">{item.message}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-2">
                        {i.pagesAffected(item.count)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {impact}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {!latestRun && (
        <EmptyState
          icon={Stethoscope}
          title={i.emptyTitle}
          description={i.emptyDesc}
          action={
            <RunAuditButton
              label={i.runFirstAudit}
              activeStatus={null}
            />
          }
        />
      )}

      {/* Free / out-of-credits notice when checks ran but synthesis was skipped */}
      {latestRun?.status === "done" &&
        !synthesis &&
        latestRun.error?.startsWith("synthesis_skipped:") && (
          <section className="rounded-2xl border border-dashed border-border p-6 max-w-3xl">
            <p className="text-sm">
              <strong>{i.synthesisSkippedTitle}</strong>{" "}
              {latestRun.error.includes("free_plan")
                ? i.synthesisFreePlan
                : latestRun.error.includes("insufficient_credits")
                  ? i.synthesisInsufficientCredits
                  : i.synthesisFallback}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {i.findingsBelow}{" "}
              <a href="/dashboard/billing" className="underline">
                {i.manageBilling}
              </a>
            </p>
          </section>
        )}

      {synthesis && (
        <section className="rounded-2xl bg-card p-6 md:p-8">
          <div className="font-mono text-[10px] text-muted-foreground">
            {i.aiSynthesisKicker}
          </div>
          <h2 className="font-display text-2xl md:text-3xl mt-2">{i.topActions}</h2>
          <p className="mt-4 text-base leading-relaxed">{synthesis.summary}</p>

          <div className="mt-6 space-y-2">
            {synthesis.top_actions.map((a, idx) => (
              <div key={idx} className="rounded-[12px] bg-background p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityPill priority={a.priority} />
                  <span className="text-sm font-medium">{a.action}</span>
                </div>
                {a.target_url && (
                  <div className="text-xs text-muted-foreground mt-2 font-mono tabular truncate">
                    {a.target_url} · {i.effortMin(a.estimated_effort_min)}
                  </div>
                )}
                {!a.target_url && (
                  <div className="text-xs text-muted-foreground mt-2 font-mono tabular">
                    {i.siteWide} · {i.effortMin(a.estimated_effort_min)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.why}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {findings.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] text-muted-foreground mb-3">
            {i.allFindings(findings.length)}
          </h2>
          <div className="space-y-4">
            {Array.from(byUrl.entries()).map(([url, items]) => (
              <div key={url} className="rounded-2xl bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                  <div className="font-mono tabular text-xs text-muted-foreground truncate flex-1 min-w-0">
                    {url}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {i.findingCount(items.length)}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {items.map((f) => (
                    <div key={f.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${SEVERITY_TONE[f.severity]}`}
                        >
                          {f.severity}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase rounded-full">
                          {f.category}
                        </Badge>
                        <span className="text-sm font-medium">{f.message}</span>
                      </div>
                      {f.detail && (
                        <div className="text-xs text-muted-foreground mt-1 font-mono tabular">
                          {f.detail}
                        </div>
                      )}
                      {f.fix && (
                        <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {f.fix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const cls =
    priority === "high"
      ? "bg-[var(--down)] text-background"
      : priority === "medium"
        ? "bg-yellow-500 text-background"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${cls}`}
    >
      {priority}
    </span>
  );
}
