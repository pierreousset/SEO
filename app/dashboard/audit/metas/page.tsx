import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Check, X, AlertTriangle, Globe, MapPin, Unlink } from "lucide-react";
import { RunMetaCrawlButton } from "@/components/run-meta-crawl-button";
import { ExportCsvButton } from "@/components/export-csv-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MetaSuggestionButton } from "@/components/meta-suggestion-button";
import { BulkMetaSuggestionButton } from "@/components/bulk-meta-suggestion-button";
import { SchemaGeneratorButton } from "@/components/schema-generator-button";

export const dynamic = "force-dynamic";

function titleStatus(len: number | null): { icon: typeof Check; cls: string } {
  if (!len) return { icon: X, cls: "text-[var(--down)]" };
  if (len < 30 || len > 70) return { icon: AlertTriangle, cls: "text-yellow-500" };
  return { icon: Check, cls: "text-[var(--up)]" };
}

function descStatus(len: number | null): { icon: typeof Check; cls: string } {
  if (!len) return { icon: X, cls: "text-[var(--down)]" };
  if (len < 80 || len > 170) return { icon: AlertTriangle, cls: "text-yellow-500" };
  return { icon: Check, cls: "text-[var(--up)]" };
}

export default async function MetasPage() {
  const ctx = await resolveAccountContext();

  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(eq(schema.metaCrawlRuns.userId, ctx.ownerId))
    .orderBy(desc(schema.metaCrawlRuns.queuedAt))
    .limit(1);

  const pages =
    latestRun?.status === "done"
      ? await db
          .select()
          .from(schema.metaCrawlPages)
          .where(eq(schema.metaCrawlPages.runId, latestRun.id))
      : [];

  const totalPages = pages.length;
  const missingTitle = pages.filter((m) => !m.title).length;
  const missingDesc = pages.filter((m) => !m.metaDescription).length;
  const noindex = pages.filter((m) => !m.indexable).length;
  const inSitemap = pages.filter((m) => m.inSitemap).length;
  const orphans = pages.filter((m) => !m.inSitemap).length;

  const runStatus = (latestRun?.status as "queued" | "running" | "done" | "failed" | null) ?? null;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <Breadcrumbs />
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Full site crawl
          </p>
          <h1 className="font-display text-[40px] mt-2">
            Metas & sitemap coverage
          </h1>
          {latestRun && latestRun.status === "done" && (
            <p className="text-xs text-muted-foreground mt-2 font-mono tabular">
              {new Date(latestRun.queuedAt).toLocaleDateString()} · {totalPages} pages ·{" "}
              {latestRun.sitemapUrls ?? 0} in sitemap · {latestRun.orphanPages ?? 0} orphans
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pages.length > 0 && <BulkMetaSuggestionButton />}
          <ExportCsvButton type="metas" />
          <RunMetaCrawlButton
            label={latestRun ? "Re-crawl site" : "Crawl all pages"}
            activeStatus={runStatus}
          />
        </div>
      </header>

      {/* Status banner for active/failed runs */}
      {runStatus === "queued" && (
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-sm text-muted-foreground">
          Crawl queued. Starting…
        </div>
      )}
      {runStatus === "running" && (
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-sm text-muted-foreground">
          Crawling your site pages… This takes 1-3 min depending on the number of pages in your sitemap.
        </div>
      )}
      {runStatus === "failed" && (
        <div className="rounded-2xl bg-[var(--down)]/5 border border-[var(--down)]/20 p-6 text-sm">
          <p className="text-[var(--down)] font-medium">Crawl failed</p>
          {latestRun?.error && (
            <p className="text-muted-foreground mt-1 font-mono text-xs">{latestRun.error}</p>
          )}
        </div>
      )}

      {!latestRun && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl text-sm">
          <p className="text-muted-foreground">
            Parses your sitemap.xml, crawls every page to extract title & meta description,
            then discovers pages linked internally but missing from the sitemap. Takes 1-3 min.
            Free for all users.
          </p>
        </div>
      )}

      {pages.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard icon={Globe} label="Pages" value={totalPages} />
            <SummaryCard icon={MapPin} label="In sitemap" value={inSitemap} />
            <SummaryCard icon={Unlink} label="Orphans" value={orphans} alert={orphans > 0} />
            <SummaryCard icon={X} label="No title" value={missingTitle} alert={missingTitle > 0} />
            <SummaryCard icon={X} label="No description" value={missingDesc} alert={missingDesc > 0} />
            <SummaryCard icon={AlertTriangle} label="Noindex" value={noindex} alert={noindex > 0} />
          </div>

          {/* Orphan pages warning */}
          {orphans > 0 && (
            <section className="rounded-2xl bg-yellow-500/5 border border-yellow-500/20 p-6">
              <h2 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                {orphans} page{orphans > 1 ? "s" : ""} missing from sitemap
              </h2>
              <p className="text-xs text-muted-foreground mt-2">
                These pages are linked internally but not listed in your sitemap.xml.
                Add them so Google discovers and indexes them faster.
              </p>
              <div className="mt-3 space-y-1">
                {pages
                  .filter((p) => !p.inSitemap)
                  .map((p) => (
                    <div key={p.id} className="text-xs font-mono tabular text-muted-foreground">
                      {stripOrigin(p.url)}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Full metas table */}
          <section>
            <h2 className="font-mono text-[10px] text-muted-foreground mb-3">
              all pages ({totalPages})
            </h2>
            <div className="bg-card rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">URL</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">Title</th>
                    <th className="text-center px-3 py-2.5 w-14 font-mono text-[9px] text-muted-foreground font-normal">Len</th>
                    <th className="text-center px-2 py-2.5 w-10"></th>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">Meta description</th>
                    <th className="text-center px-3 py-2.5 w-14 font-mono text-[9px] text-muted-foreground font-normal">Len</th>
                    <th className="text-center px-2 py-2.5 w-10"></th>
                    <th className="text-left px-4 py-2.5 font-mono text-[9px] text-muted-foreground font-normal">H1</th>
                    <th className="text-center px-3 py-2.5 w-16 font-mono text-[9px] text-muted-foreground font-normal">Sitemap</th>
                    <th className="text-center px-3 py-2.5 w-16 font-mono text-[9px] text-muted-foreground font-normal">Index</th>
                    <th className="text-center px-3 py-2.5 w-28 font-mono text-[9px] text-muted-foreground font-normal">AI</th>
                    <th className="text-center px-3 py-2.5 w-20 font-mono text-[9px] text-muted-foreground font-normal">Schema</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((m) => {
                    const ts = titleStatus(m.titleLength);
                    const ds = descStatus(m.metaDescriptionLength);
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-border last:border-0 hover:bg-secondary/50 ${
                          !m.inSitemap ? "bg-yellow-500/[0.03]" : ""
                        }`}
                      >
                        <td
                          className="px-4 py-3 font-mono tabular text-xs text-muted-foreground truncate max-w-[180px]"
                          title={m.url}
                        >
                          {stripOrigin(m.url)}
                        </td>
                        <td className="px-4 py-3 truncate max-w-[220px]" title={m.title ?? ""}>
                          {m.title || (
                            <span className="text-[var(--down)] text-xs">Missing</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono tabular text-xs">
                          {m.titleLength ?? 0}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <ts.icon
                            className={`h-3.5 w-3.5 mx-auto ${ts.cls}`}
                            strokeWidth={2}
                          />
                        </td>
                        <td
                          className="px-4 py-3 truncate max-w-[250px]"
                          title={m.metaDescription ?? ""}
                        >
                          {m.metaDescription || (
                            <span className="text-[var(--down)] text-xs">Missing</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono tabular text-xs">
                          {m.metaDescriptionLength ?? 0}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <ds.icon
                            className={`h-3.5 w-3.5 mx-auto ${ds.cls}`}
                            strokeWidth={2}
                          />
                        </td>
                        <td
                          className="px-4 py-3 truncate max-w-[180px] text-xs text-muted-foreground"
                          title={m.h1 ?? ""}
                        >
                          {m.h1 || (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {m.inSitemap ? (
                            <Check
                              className="h-3.5 w-3.5 mx-auto text-[var(--up)]"
                              strokeWidth={2}
                            />
                          ) : (
                            <X
                              className="h-3.5 w-3.5 mx-auto text-yellow-500"
                              strokeWidth={2}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {m.indexable ? (
                            <Check
                              className="h-3.5 w-3.5 mx-auto text-[var(--up)]"
                              strokeWidth={2}
                            />
                          ) : (
                            <X
                              className="h-3.5 w-3.5 mx-auto text-[var(--down)]"
                              strokeWidth={2}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {(!m.title || (m.titleLength ?? 0) < 30 || !m.metaDescription || (m.metaDescriptionLength ?? 0) < 80) && (
                            <MetaSuggestionButton url={m.url} />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <SchemaGeneratorButton url={m.url} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: typeof Globe;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {label}
      </div>
      <div
        className={`font-display text-3xl mt-2 tabular ${
          alert ? "text-[var(--down)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function stripOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}
