import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc, and } from "drizzle-orm";
import { RunAuditButton } from "@/components/run-audit-button";
import { AuditStatusBanner } from "@/components/audit-status-banner";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ShareLinkButton } from "@/components/share-link-button";
import { Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";
import { AuditFixCards } from "@/components/audit-fix-cards";
import { AuditFindingsList } from "@/components/audit-findings-list";
import { auditCopy, localizeFinding, resolveAuditLang } from "@/lib/audit/messages";
import { missingTrackedKeywords, titleFromDetail } from "@/lib/audit/keyword-context";
import { tenantDb } from "@/db/client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const lng = await getLocale();
  const i = locale[lng];
  const profile = await t.selectBusinessProfile();

  const [latestRun] = await db
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.auditRuns.queuedAt))
    .limit(1);

  const rawFindings = latestRun
    ? await db
        .select()
        .from(schema.auditFindings)
        .where(eq(schema.auditFindings.runId, latestRun.id))
        .orderBy(desc(schema.auditFindings.severity))
    : [];
  const siteLang = resolveAuditLang({
    urls: rawFindings.map((f) => f.url),
    profileLang: profile?.preferredLanguage,
    uiLang: lng,
  });
  const keywordRows = await t.selectKeywords();
  const tracked = keywordRows.filter((k) => !k.removedAt).map((k) => k.query);
  const findings = rawFindings.map((f) => {
    const loc = localizeFinding(f, siteLang);
    if (loc.checkKey !== "title_no_keyword") return { ...loc, keywords: [] as string[] };
    const title = titleFromDetail(loc.detail);
    const keywords = missingTrackedKeywords(loc.url, title, tracked);
    const copy = auditCopy("title_no_keyword", siteLang, { missing: keywords.join(", ") });
    return { ...loc, keywords, fix: copy?.fix ?? loc.fix };
  });

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

  const highByCheck = new Map<
    string,
    { message: string; checkKey: string; pages: typeof highFindings }
  >();
  for (const f of highFindings) {
    const existing = highByCheck.get(f.checkKey);
    if (existing) {
      existing.pages.push(f);
    } else {
      highByCheck.set(f.checkKey, { message: f.message, checkKey: f.checkKey, pages: [f] });
    }
  }
  const topFixFirst = Array.from(highByCheck.values())
    .sort((a, b) => b.pages.length - a.pages.length)
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
          <p className="text-caption text-ash-gray">{i.headerKicker}</p>
          <h1 className="text-heading-lg mt-2">{i.title}</h1>
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
                <span className="text-caption text-ash-gray">{i.sinceLastAudit}</span>
              </div>
            </div>
          )}

          {topFixFirst.length > 0 && (
            <div>
              <h2 className="text-caption text-ash-gray mb-3">{i.fixFirst}</h2>
              <AuditFixCards
                lang={siteLang}
                copy={{
                  howToFix: i.detailHowTo,
                  pages: i.detailPages,
                  open: i.detailOpen,
                  copy: i.detailCopy,
                  copied: i.detailCopied,
                  keywords: i.detailKeywords,
                  tryFirst: i.detailTryFirst,
                  aiPaste: i.detailAiPaste,
                }}
                items={topFixFirst.map((item) => ({
                  checkKey: item.checkKey,
                  message: item.message,
                  countLabel: i.pagesAffected(item.pages.length),
                  impact:
                    auditCopy(item.checkKey, siteLang)?.impact ??
                    i.defaultImpact(item.pages.length),
                  fix: item.pages.find((p) => p.fix)?.fix ?? null,
                  pages: item.pages.map((p) => ({ url: p.url, detail: p.detail })),
                  keywords: [...new Set(item.pages.flatMap((p) => p.keywords ?? []))],
                }))}
              />
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
          <div className="text-caption text-ash-gray">
            {i.aiSynthesisKicker}
          </div>
          <h2 className="text-heading mt-2">{i.topActions}</h2>
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
          <h2 className="text-caption text-ash-gray mb-3">
            {i.allFindings(findings.length)}
          </h2>
          <AuditFindingsList
            lang={siteLang}
            copy={{
              howToFix: i.detailHowTo,
              seen: i.detailSeen,
              inspect: i.detailInspect,
              selector: i.detailSelector,
              open: i.detailOpen,
              copy: i.detailCopy,
              copied: i.detailCopied,
              keywords: i.detailKeywords,
              tryFirst: i.detailTryFirst,
              aiPaste: i.detailAiPaste,
              severity: {
                high: i.severityHigh,
                medium: i.severityMedium,
                low: i.severityLow,
                info: i.severityInfo,
              },
            }}
            groups={Array.from(byUrl.entries()).map(([url, items]) => ({
              url,
              countLabel: i.findingCount(items.length),
              items: items.map((f) => ({
                id: f.id,
                url: f.url,
                checkKey: f.checkKey,
                severity: f.severity,
                category: f.category,
                message: f.message,
                detail: f.detail,
                fix: f.fix,
                keywords: f.keywords ?? [],
              })),
            }))}
          />
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
        ? "bg-vivid-violet text-background"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-block text-caption px-2.5 py-1 rounded-full ${cls}`}
    >
      {priority}
    </span>
  );
}
