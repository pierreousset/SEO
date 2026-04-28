"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { fetchWebVitals } from "@/lib/page-speed";

export async function checkWebVitals(url: string) {
  const ctx = await requireAccountContext();

  const result = await fetchWebVitals(url);
  if (!result) return { error: "PageSpeed API returned no data for this URL." };

  await db.insert(schema.webVitals).values({
    id: randomUUID(),
    userId: ctx.ownerId,
    url: result.url,
    performanceScore: result.performanceScore,
    lcp: Math.round(result.lcp),
    fcp: Math.round(result.fcp),
    cls: result.cls,
    ttfb: Math.round(result.ttfb),
    fetchedAt: new Date(result.fetchedAt),
  });

  revalidatePath("/dashboard/pages");
  return { ok: true, result };
}

export async function checkWebVitalsForSite() {
  const ctx = await requireAccountContext();

  // Get top 5 pages by clicks from GSC data (last 28 days)
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 28);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const topPages = await db
    .select({
      url: schema.gscPageMetrics.url,
      clicks: sql<number>`sum(${schema.gscPageMetrics.clicks})::int`,
    })
    .from(schema.gscPageMetrics)
    .where(
      and(
        eq(schema.gscPageMetrics.userId, ctx.ownerId),
        gte(schema.gscPageMetrics.date, cutoffStr),
      ),
    )
    .groupBy(schema.gscPageMetrics.url)
    .orderBy(desc(sql`sum(${schema.gscPageMetrics.clicks})`))
    .limit(5);

  if (topPages.length === 0) {
    return { error: "No pages found. Pull GSC history first." };
  }

  const results = [];
  for (const page of topPages) {
    const result = await fetchWebVitals(page.url);
    if (result) {
      await db.insert(schema.webVitals).values({
        id: randomUUID(),
        userId: ctx.ownerId,
        url: result.url,
        performanceScore: result.performanceScore,
        lcp: Math.round(result.lcp),
        fcp: Math.round(result.fcp),
        cls: result.cls,
        ttfb: Math.round(result.ttfb),
        fetchedAt: new Date(result.fetchedAt),
      });
      results.push(result);
    }
  }

  revalidatePath("/dashboard/pages");
  return { ok: true, results };
}
