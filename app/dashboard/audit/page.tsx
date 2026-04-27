import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { RunAuditButton } from "@/components/run-audit-button";
import { AuditStatusBanner } from "@/components/audit-status-banner";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-[var(--down)]/10 text-[var(--down)]",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  low: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
};

export default async function AuditPage() {
  const ctx = await resolveAccountContext();

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

  // Group findings by URL for the detail table
  const byUrl = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, []);
    byUrl.get(f.url)!.push(f);
  }

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Site audit</p>
          <h1 className="font-display text-[40px] mt-3">Audit</h1>
        </div>
        <RunAuditButton
          label={latestRun ? "Run new audit" : "Run first audit"}
          activeStatus={(latestRun?.status as any) ?? null}
        />
      </header>

      <AuditStatusBanner run={banner} />

      {!latestRun && (
        <div className="rounded-2xl bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg text-muted-foreground">
            Crawl your homepage + top 10 pages from sitemap, run 14 SEO checks on both raw HTML
            <strong> and JS-rendered DOM</strong> (so we see what Google sees post-hydration),
            then let the AI prioritize the fixes. Takes 1-2 minutes.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Click <strong>Run first audit</strong> in the header to start.
          </p>
        </div>
      )}

      {/* Free / out-of-credits notice when checks ran but synthesis was skipped */}
      {latestRun?.status === "done" &&
        !synthesis &&
        latestRun.error?.startsWith("synthesis_skipped:") && (
          <section className="rounded-2xl border border-dashed border-border p-6 max-w-3xl">
            <p className="text-sm">
              <strong>AI synthesis skipped.</strong>{" "}
              {latestRun.error.includes("free_plan")
                ? "Free plan only delivers raw findings. Upgrade to Pro to get prioritized AI actions."
                : latestRun.error.includes("insufficient_credits")
                  ? "Not enough credits to run AI synthesis (4 needed). Buy a credit pack to unlock."
                  : "Synthesis couldn't run on this audit."}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              All findings are still listed below.{" "}
              <a href="/dashboard/billing" className="underline">
                Manage billing →
              </a>
            </p>
          </section>
        )}

      {synthesis && (
        <section className="rounded-2xl bg-secondary p-6 md:p-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            AI synthesis
          </div>
          <h2 className="font-display text-2xl md:text-3xl mt-2">Top actions</h2>
          <p className="mt-4 text-base leading-relaxed">{synthesis.summary}</p>

          <div className="mt-6 space-y-2">
            {synthesis.top_actions.map((a, i) => (
              <div key={i} className="rounded-[12px] bg-background p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityPill priority={a.priority} />
                  <span className="text-sm font-medium">{a.action}</span>
                </div>
                {a.target_url && (
                  <div className="text-xs text-muted-foreground mt-2 font-mono tabular truncate">
                    {a.target_url} · ~{a.estimated_effort_min}min
                  </div>
                )}
                {!a.target_url && (
                  <div className="text-xs text-muted-foreground mt-2 font-mono tabular">
                    site-wide · ~{a.estimated_effort_min}min
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
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            All findings ({findings.length})
          </h2>
          <div className="space-y-4">
            {Array.from(byUrl.entries()).map(([url, items]) => (
              <div key={url} className="rounded-2xl bg-secondary overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                  <div className="font-mono tabular text-xs text-muted-foreground truncate flex-1 min-w-0">
                    {url}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {items.length} finding{items.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {items.map((f) => (
                    <div key={f.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block text-[10px] uppercase font-medium px-1.5 py-0.5 rounded-sm ${SEVERITY_TONE[f.severity]}`}
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
      className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${cls}`}
    >
      {priority}
    </span>
  );
}
