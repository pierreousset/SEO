import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { GenerateArticleForm } from "@/components/generate-article-form";
import { PenTool } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SortableHeader } from "@/components/sortable-header";
import { parseSort, sortRows } from "@/lib/table-sort";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveAccountContext();
  const sp = await searchParams;

  // Load tracked keywords for the dropdown
  const keywords = await db
    .select({ id: schema.keywords.id, query: schema.keywords.query })
    .from(schema.keywords)
    .where(eq(schema.keywords.userId, ctx.ownerId));

  // Load all generated articles
  const articles = await db
    .select({
      id: schema.generatedArticles.id,
      title: schema.generatedArticles.title,
      keywordId: schema.generatedArticles.keywordId,
      wordCount: schema.generatedArticles.wordCount,
      status: schema.generatedArticles.status,
      createdAt: schema.generatedArticles.createdAt,
    })
    .from(schema.generatedArticles)
    .where(eq(schema.generatedArticles.userId, ctx.ownerId))
    .orderBy(desc(schema.generatedArticles.createdAt));

  // Build keyword lookup
  const kwMap = new Map(keywords.map((k) => [k.id, k.query]));

  const { field: sortField, dir: sortDir } = parseSort(sp, "createdAt", "desc");
  const sortedArticles = sortRows(articles, sortField, sortDir, {
    title: (a) => a.title?.toLowerCase() ?? null,
    keyword: (a) => (a.keywordId ? kwMap.get(a.keywordId)?.toLowerCase() ?? null : null),
    wordCount: (a) => a.wordCount,
    status: (a) => a.status,
    createdAt: (a) => a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as unknown as string).getTime(),
  });

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-caption text-ash-gray">
          content
        </p>
        <h1 className="text-heading-lg mt-2">Article Generator</h1>
      </header>

      {/* Generation form */}
      <section className="rounded-2xl bg-card p-6 md:p-8 max-w-2xl">
        <h2 className="text-heading mb-4">Generate a new article</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Select a tracked keyword or enter a custom topic. Claude will produce an
          800-1500 word SEO-optimized article in markdown.
        </p>
        <GenerateArticleForm
          keywords={keywords.map((k) => ({ id: k.id, query: k.query }))}
        />
      </section>

      {/* Articles list */}
      {articles.length > 0 && (
        <section className="rounded-2xl bg-card p-6 md:p-8">
          <h2 className="text-heading mb-6">Generated articles</h2>
          <div className="rounded-[12px] bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3">
                    <SortableHeader field="title" label="title" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortableHeader field="keyword" label="keyword" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                  </th>
                  <th className="text-right px-3 py-3">
                    <SortableHeader field="wordCount" label="words" align="right" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                  </th>
                  <th className="text-left px-3 py-3">
                    <SortableHeader field="status" label="status" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortableHeader field="createdAt" label="date" currentSort={sortField} currentDir={sortDir} searchParams={sp} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 truncate max-w-[300px]">
                      {a.status === "done" ? (
                        <Link
                          href={`/dashboard/content/${a.id}`}
                          className="hover:underline"
                        >
                          {a.title || "Untitled"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {a.title || "Generating..."}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">
                      {a.keywordId ? kwMap.get(a.keywordId) ?? "—" : "Custom topic"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {a.wordCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-xs text-muted-foreground">
                      {a.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {articles.length === 0 && (
        <EmptyState
          icon={PenTool}
          title="No articles generated yet"
          description="Generate SEO-optimized articles from your tracked keywords. Each article costs 5 credits. Use the form above to get started."
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-vivid-violet/10 text-vivid-violet",
    generating: "bg-blue-500/15 text-blue-400",
    done: "bg-sky-teal/10 text-sky-teal",
    failed: "bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[status] ?? "bg-foreground/10 text-foreground"}`}
    >
      {status}
    </span>
  );
}
