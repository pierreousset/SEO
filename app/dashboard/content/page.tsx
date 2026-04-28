import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { GenerateArticleForm } from "@/components/generate-article-form";
import { PenTool } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const ctx = await resolveAccountContext();

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

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          content
        </p>
        <h1 className="font-display text-[40px] mt-2">Article Generator</h1>
      </header>

      {/* Generation form */}
      <section className="rounded-2xl bg-card p-6 md:p-8 max-w-2xl">
        <h2 className="font-display text-2xl mb-4">Generate a new article</h2>
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
          <h2 className="font-display text-2xl md:text-3xl mb-6">Generated articles</h2>
          <div className="rounded-[12px] bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">title</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">keyword</th>
                  <th className="text-right px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">words</th>
                  <th className="text-left px-3 py-3 font-mono text-[9px] text-muted-foreground font-normal">status</th>
                  <th className="text-left px-4 py-3 font-mono text-[9px] text-muted-foreground font-normal">date</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
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
    queued: "bg-yellow-500/15 text-yellow-400",
    generating: "bg-blue-500/15 text-blue-400",
    done: "bg-emerald-500/15 text-emerald-400",
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
