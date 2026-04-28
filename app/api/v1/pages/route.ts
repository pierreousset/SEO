import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await authenticateApiRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the latest meta crawl run
  const [latestRun] = await db
    .select()
    .from(schema.metaCrawlRuns)
    .where(eq(schema.metaCrawlRuns.userId, userId))
    .orderBy(desc(schema.metaCrawlRuns.finishedAt))
    .limit(1);

  if (!latestRun) {
    return NextResponse.json({ pages: [], message: "No crawl data yet" });
  }

  const pages = await db
    .select({
      url: schema.metaCrawlPages.url,
      title: schema.metaCrawlPages.title,
      metaDescription: schema.metaCrawlPages.metaDescription,
      h1: schema.metaCrawlPages.h1,
      wordCount: schema.metaCrawlPages.wordCount,
      httpStatus: schema.metaCrawlPages.httpStatus,
      responseMs: schema.metaCrawlPages.responseMs,
      indexable: schema.metaCrawlPages.indexable,
      inSitemap: schema.metaCrawlPages.inSitemap,
      internalLinksOut: schema.metaCrawlPages.internalLinksOut,
    })
    .from(schema.metaCrawlPages)
    .where(eq(schema.metaCrawlPages.runId, latestRun.id));

  return NextResponse.json({
    crawlRunId: latestRun.id,
    crawledAt: latestRun.finishedAt,
    pages,
  });
}
