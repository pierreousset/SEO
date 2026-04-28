import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Link2, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { suggestInternalLinks } from "@/lib/internal-linking";
import type { CrawlPage, Keyword } from "@/lib/internal-linking";

export const dynamic = "force-dynamic";

function stripOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-[var(--up)]/10 text-[var(--up)]",
    medium: "bg-yellow-500/10 text-yellow-500",
    low: "bg-muted-foreground/10 text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[impact]}`}
    >
      {impact}
    </span>
  );
}

export default async function InternalLinksPage() {
  const ctx = await resolveAccountContext();

  // Get latest completed crawl run
  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(eq(schema.metaCrawlRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.metaCrawlRuns.queuedAt))
    .limit(1);

  const pages: CrawlPage[] =
    latestRun?.status === "done"
      ? (
          await db
            .select({
              url: schema.metaCrawlPages.url,
              title: schema.metaCrawlPages.title,
              h1: schema.metaCrawlPages.h1,
              wordCount: schema.metaCrawlPages.wordCount,
              internalLinksOut: schema.metaCrawlPages.internalLinksOut,
              linkedFrom: schema.metaCrawlPages.linkedFrom,
            })
            .from(schema.metaCrawlPages)
            .where(eq(schema.metaCrawlPages.runId, latestRun.id))
        )
      : [];

  // Get tracked keywords
  const keywords: Keyword[] = await db
    .select({
      query: schema.keywords.query,
      intentStage: schema.keywords.intentStage,
    })
    .from(schema.keywords)
    .where(eq(schema.keywords.userId, ctx.ownerId));

  const suggestions = pages.length > 0 ? suggestInternalLinks(pages, keywords) : [];

  const highCount = suggestions.filter((s) => s.impact === "high").length;
  const mediumCount = suggestions.filter((s) => s.impact === "medium").length;
  const lowCount = suggestions.filter((s) => s.impact === "low").length;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <Breadcrumbs />
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          internal links
        </p>
        <h1 className="font-display text-[40px] mt-2">Link Suggestions</h1>
        {suggestions.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 font-mono tabular">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} to improve your
            internal linking
          </p>
        )}
      </header>

      {/* Empty state: no crawl data */}
      {pages.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl text-sm">
          <p className="text-muted-foreground">
            Run a meta crawl first to get link suggestions. Go to{" "}
            <a href="/dashboard/audit/metas" className="text-primary hover:underline">
              Audit &rarr; Metas
            </a>{" "}
            and crawl your site.
          </p>
        </div>
      )}

      {/* Summary cards */}
      {suggestions.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total" value={suggestions.length} />
            <SummaryCard label="High impact" value={highCount} highlight />
            <SummaryCard label="Medium" value={mediumCount} />
            <SummaryCard label="Low" value={lowCount} />
          </div>

          {/* Suggestions table */}
          <section>
            <h2 className="font-mono text-[10px] text-muted-foreground mb-3">
              suggestions ({suggestions.length})
            </h2>
            <div className="bg-card rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">
                      From
                    </th>
                    <th className="w-8" />
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">
                      To
                    </th>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">
                      Reason
                    </th>
                    <th className="text-center px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal w-24">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-3 max-w-[200px]">
                        <div
                          className="font-mono tabular text-xs text-muted-foreground truncate"
                          title={s.fromUrl}
                        >
                          {stripOrigin(s.fromUrl)}
                        </div>
                        {s.fromTitle && (
                          <div className="text-xs truncate mt-0.5" title={s.fromTitle}>
                            {s.fromTitle}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <ArrowRight className="h-3.5 w-3.5 mx-auto text-muted-foreground" strokeWidth={1.5} />
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div
                          className="font-mono tabular text-xs text-muted-foreground truncate"
                          title={s.toUrl}
                        >
                          {stripOrigin(s.toUrl)}
                        </div>
                        {s.toTitle && (
                          <div className="text-xs truncate mt-0.5" title={s.toTitle}>
                            {s.toTitle}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                        <span className="line-clamp-2">{s.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ImpactBadge impact={s.impact} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Crawl exists but no suggestions */}
      {pages.length > 0 && suggestions.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl text-sm">
          <div className="flex items-center gap-2 text-[var(--up)] mb-2">
            <Link2 className="h-4 w-4" strokeWidth={1.5} />
            <span className="font-semibold text-sm">Looking good</span>
          </div>
          <p className="text-muted-foreground">
            No internal linking issues found. Your pages are well cross-linked.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`font-display text-3xl mt-2 tabular ${
          highlight && value > 0 ? "text-[var(--up)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
