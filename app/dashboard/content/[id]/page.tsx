import { notFound } from "next/navigation";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { ArticleRenderer } from "@/components/article-renderer";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveAccountContext();

  const [article] = await db
    .select()
    .from(schema.generatedArticles)
    .where(
      and(
        eq(schema.generatedArticles.id, id),
        eq(schema.generatedArticles.userId, ctx.ownerId),
      ),
    )
    .limit(1);

  if (!article) notFound();

  // Load keyword name if linked
  let keywordQuery: string | null = null;
  if (article.keywordId) {
    const [kw] = await db
      .select({ query: schema.keywords.query })
      .from(schema.keywords)
      .where(eq(schema.keywords.id, article.keywordId))
      .limit(1);
    keywordQuery = kw?.query ?? null;
  }

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[900px] mx-auto space-y-8">
      <Breadcrumbs />
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          generated article
        </p>
        <h1 className="font-display text-[40px] mt-3">{article.title || "Untitled"}</h1>
      </header>

      {/* Meta stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Word count" value={article.wordCount?.toLocaleString() ?? "—"} />
        <StatTile label="Model" value={article.model ?? "—"} />
        <StatTile label="Keyword" value={keywordQuery ?? "Custom topic"} />
        <StatTile label="Status" value={article.status} />
      </section>

      {/* Meta description */}
      {article.metaDescription && (
        <section className="rounded-2xl bg-secondary p-6">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Meta description
          </h2>
          <p className="text-sm">{article.metaDescription}</p>
        </section>
      )}

      {/* Copy button */}
      <div className="flex justify-end">
        <CopyMarkdownButton markdown={article.content} />
      </div>

      {/* Article content */}
      {article.status === "done" && article.content ? (
        <section className="rounded-2xl bg-secondary p-6 md:p-10">
          <ArticleRenderer content={article.content} />
        </section>
      ) : article.status === "failed" ? (
        <section className="rounded-2xl bg-red-500/10 p-8">
          <p className="text-lg text-red-400">
            Article generation failed. Your credits have been charged. Please try again.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl bg-secondary p-8">
          <p className="text-lg text-muted-foreground">
            Article is being generated. Refresh the page in a moment...
          </p>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono tabular-nums text-sm truncate">{value}</div>
    </div>
  );
}
