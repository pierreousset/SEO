/**
 * Gathers all data for a user and recomputes the SEO health score.
 * Called by Inngest after daily fetch completes.
 */

import { randomUUID } from "node:crypto";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  computeGlobalScore,
  detectPageIssues,
  detectKeywordIssues,
  type SiteData,
  type PageData,
  type KeywordData,
} from "./seo-score";

export async function recomputeSeoScore(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const cutoff7d = sevenDaysAgo.toISOString().slice(0, 10);

  // Load all needed data in parallel
  const [
    keywords,
    positions,
    gscPageMetrics,
    auditFindings,
    crawlData,
    sites,
  ] = await Promise.all([
    db
      .select()
      .from(schema.keywords)
      .where(eq(schema.keywords.userId, userId)),
    db
      .select()
      .from(schema.positions)
      .where(and(eq(schema.positions.userId, userId), gte(schema.positions.date, cutoff7d)))
      .orderBy(desc(schema.positions.date)),
    db
      .select({
        url: schema.gscPageMetrics.url,
        clicks: sql<number>`sum(${schema.gscPageMetrics.clicks})::int`,
        impressions: sql<number>`sum(${schema.gscPageMetrics.impressions})::int`,
        avgPosition: sql<number>`avg(${schema.gscPageMetrics.position}::numeric)::float`,
      })
      .from(schema.gscPageMetrics)
      .where(
        and(
          eq(schema.gscPageMetrics.userId, userId),
          gte(schema.gscPageMetrics.date, cutoff),
        ),
      )
      .groupBy(schema.gscPageMetrics.url),
    // Latest audit findings
    db
      .select({ severity: schema.auditFindings.severity, category: schema.auditFindings.category })
      .from(schema.auditFindings)
      .innerJoin(schema.auditRuns, eq(schema.auditFindings.runId, schema.auditRuns.id))
      .where(and(eq(schema.auditFindings.userId, userId), eq(schema.auditRuns.status, "done")))
      .orderBy(desc(schema.auditRuns.finishedAt))
      .limit(200),
    // Latest crawl data
    db
      .select({
        sitemapUrls: schema.metaCrawlRuns.sitemapUrls,
        pagesCrawled: schema.metaCrawlRuns.pagesCrawled,
      })
      .from(schema.metaCrawlRuns)
      .where(and(eq(schema.metaCrawlRuns.userId, userId), eq(schema.metaCrawlRuns.status, "done")))
      .orderBy(desc(schema.metaCrawlRuns.finishedAt))
      .limit(1),
    db.select().from(schema.sites).where(eq(schema.sites.userId, userId)).limit(1),
  ]);

  // Get meta crawl page data for title/meta/h1 info
  let crawlPages: Array<{
    url: string;
    title: string | null;
    titleLength: number | null;
    metaDescription: string | null;
    metaDescriptionLength: number | null;
    h1: string | null;
    inSitemap: boolean;
    indexable: boolean;
  }> = [];

  if (crawlData.length > 0) {
    const [latestCrawl] = await db
      .select()
      .from(schema.metaCrawlRuns)
      .where(and(eq(schema.metaCrawlRuns.userId, userId), eq(schema.metaCrawlRuns.status, "done")))
      .orderBy(desc(schema.metaCrawlRuns.finishedAt))
      .limit(1);
    if (latestCrawl) {
      crawlPages = await db
        .select({
          url: schema.metaCrawlPages.url,
          title: schema.metaCrawlPages.title,
          titleLength: schema.metaCrawlPages.titleLength,
          metaDescription: schema.metaCrawlPages.metaDescription,
          metaDescriptionLength: schema.metaCrawlPages.metaDescriptionLength,
          h1: schema.metaCrawlPages.h1,
          inSitemap: schema.metaCrawlPages.inSitemap,
          indexable: schema.metaCrawlPages.indexable,
        })
        .from(schema.metaCrawlPages)
        .where(eq(schema.metaCrawlPages.runId, latestCrawl.id));
    }
  }

  // Build PageData from GSC page metrics + crawl data
  const crawlByUrl = new Map(crawlPages.map((p) => [p.url, p]));
  const activeKeywords = keywords.filter((k) => !k.removedAt);

  // Build page data (merge GSC metrics with crawl meta)
  // For prev period, we'd need a second query. Simplify: use 0 for prev.
  const pages: PageData[] = gscPageMetrics.map((g) => {
    const crawl = crawlByUrl.get(g.url);
    return {
      url: g.url,
      clicks28d: g.clicks,
      impressions28d: g.impressions,
      avgPosition: g.avgPosition,
      clicksPrev28d: 0, // TODO: compute from prev 28d window
      title: crawl?.title ?? null,
      titleLength: crawl?.titleLength ?? 0,
      metaDescription: crawl?.metaDescription ?? null,
      metaDescriptionLength: crawl?.metaDescriptionLength ?? 0,
      h1: crawl?.h1 ?? null,
      inSitemap: crawl?.inSitemap ?? false,
      indexable: crawl?.indexable ?? true,
    };
  });

  // Build KeywordData
  const keywordData: KeywordData[] = activeKeywords.map((k) => {
    const history = positions
      .filter((p) => p.keywordId === k.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1)?.position ?? null;
    const prev = history.at(-2)?.position ?? null;
    const weekAgo = history.at(-8)?.position ?? null;

    // GSC metrics for this keyword
    const gscRows = gscPageMetrics; // simplified: we don't have per-keyword GSC in page metrics
    // Use keyword-level GSC metrics if available
    return {
      id: k.id,
      query: k.query,
      latestPosition: latest,
      previousPosition: prev,
      weekAgoPosition: weekAgo,
      impressions28d: 0, // would need per-keyword GSC join
      clicks28d: 0,
      intentStage: k.intentStage,
    };
  });

  const siteData: SiteData = {
    pages,
    keywords: keywordData,
    auditFindings: auditFindings.length > 0 ? auditFindings : undefined,
    sitemapUrls: crawlData[0]?.sitemapUrls ?? undefined,
    crawledPages: crawlData[0]?.pagesCrawled ?? undefined,
  };

  const { score, breakdown } = computeGlobalScore(siteData);
  const pageIssues = detectPageIssues(pages);
  const keywordIssues = detectKeywordIssues(keywordData);
  const allIssues = [...pageIssues, ...keywordIssues];

  // Upsert score
  const scoreId = randomUUID();
  await db.insert(schema.seoScores).values({
    id: scoreId,
    userId,
    siteId: sites[0]?.id ?? null,
    score,
    breakdown,
    issues: allIssues,
    computedAt: new Date(),
  });

  return { score, issueCount: allIssues.length };
}
