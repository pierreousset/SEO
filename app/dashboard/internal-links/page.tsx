import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Link2, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { suggestInternalLinks } from "@/lib/internal-linking";
import type { CrawlPage, Keyword } from "@/lib/internal-linking";
import { SortableHeader } from "@/components/sortable-header";
import { parseSort, sortRows } from "@/lib/table-sort";
import { getLocale } from "@/lib/i18n-server";
import { locale, type PageLocale } from "./locale";

export const dynamic = "force-dynamic";

function stripOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function ImpactBadge({
  impact,
  label,
}: {
  impact: "high" | "medium" | "low";
  label: string;
}) {
  const styles = {
    high: "bg-sky-teal/10 text-sky-teal",
    medium: "bg-vivid-violet/10 text-vivid-violet",
    low: "bg-subtle-cream text-ash-gray",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${styles[impact]}`}
    >
      {label}
    </span>
  );
}

export default async function InternalLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveAccountContext();
  const sp = await searchParams;
  const lng = await getLocale();
  const i = locale[lng];

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

  const rawSuggestions = pages.length > 0 ? suggestInternalLinks(pages, keywords) : [];
  const { field: sortField, dir: sortDir } = parseSort(sp, "impact", "desc");
  const impactRank = { high: 3, medium: 2, low: 1 } as const;
  const suggestions = sortRows(rawSuggestions, sortField, sortDir, {
    from: (s: typeof rawSuggestions[number]) => s.fromUrl,
    to: (s: typeof rawSuggestions[number]) => s.toUrl,
    reason: (s: typeof rawSuggestions[number]) => s.reason,
    impact: (s: typeof rawSuggestions[number]) =>
      impactRank[s.impact as keyof typeof impactRank] ?? 0,
  });

  const highCount = suggestions.filter((s) => s.impact === "high").length;
  const mediumCount = suggestions.filter((s) => s.impact === "medium").length;
  const lowCount = suggestions.filter((s) => s.impact === "low").length;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <Breadcrumbs />
        <p className="text-caption text-ash-gray">{i.headerKicker}</p>
        <h1 className="text-heading-lg mt-2">{i.title}</h1>
        {suggestions.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 font-mono tabular">
            {i.subtitle(suggestions.length)}
          </p>
        )}
      </header>

      {/* Empty state: no crawl data */}
      {pages.length === 0 && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl text-sm">
          <p className="text-muted-foreground">
            {i.emptyNoCrawlIntro}{" "}
            <a href="/dashboard/audit/metas" className="text-sky-teal hover:underline">
              {i.emptyNoCrawlLink}
            </a>{" "}
            {i.emptyNoCrawlOutro}
          </p>
        </div>
      )}

      {/* Summary cards */}
      {suggestions.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label={i.cardTotal} value={suggestions.length} />
            <SummaryCard label={i.cardHighImpact} value={highCount} highlight />
            <SummaryCard label={i.cardMedium} value={mediumCount} />
            <SummaryCard label={i.cardLow} value={lowCount} />
          </div>

          {/* Suggestions table */}
          <section>
            <h2 className="text-caption text-ash-gray mb-3">
              {i.sectionHeading(suggestions.length)}
            </h2>
            <div className="bg-card rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2.5">
                      <SortableHeader field="from" label={i.thFrom} currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="w-8" />
                    <th className="text-left px-4 py-2.5">
                      <SortableHeader field="to" label={i.thTo} currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortableHeader field="reason" label={i.thReason} currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                    <th className="text-center px-4 py-2.5 w-24">
                      <SortableHeader field="impact" label={i.thImpact} align="center" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, idx) => (
                    <tr
                      key={idx}
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
                        <ImpactBadge
                          impact={s.impact}
                          label={
                            s.impact === "high"
                              ? i.impactHigh
                              : s.impact === "medium"
                                ? i.impactMedium
                                : i.impactLow
                          }
                        />
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
          <div className="flex items-center gap-2 text-sky-teal mb-2">
            <Link2 className="h-4 w-4" strokeWidth={1.5} />
            <span className="font-semibold text-sm">{i.lookingGood}</span>
          </div>
          <p className="text-muted-foreground">{i.noSuggestions}</p>
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
      <div className="text-caption text-ash-gray">{label}</div>
      <div
        className={`text-heading mt-2 tabular ${
          highlight && value > 0 ? "text-[var(--up)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
