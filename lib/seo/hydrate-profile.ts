import { desc, eq, sql } from "drizzle-orm";
import { db, schema, tenantDb } from "@/db/client";
import { fetchHomepageCopy } from "@/lib/seo/homepage";
import { inferBusinessProfile } from "@/lib/seo/infer-profile";
import { urlToDomain } from "@/lib/dataforseo";

/**
 * Fill empty business-profile slots from site + GSC + crawl data.
 * Never overwrites a field the user already set.
 */
export async function hydrateBusinessProfile(userId: string): Promise<{
  filled: string[];
}> {
  const t = tenantDb(userId);
  const [existing, sites, keywords] = await Promise.all([
    t.selectBusinessProfile(),
    t.selectSites(),
    t.selectKeywords(),
  ]);

  const needsName = !existing?.businessName?.trim();
  const needsService = !existing?.primaryService?.trim();
  const needsCities = (existing?.targetCities ?? []).length === 0;
  if (!needsName && !needsService && !needsCities) {
    return { filled: [] };
  }

  const domain = sites[0]?.domain ? urlToDomain(sites[0].domain) : null;
  const homepage = domain ? await fetchHomepageCopy(domain) : null;

  const topQueries = await loadTopQueries(userId, 40);
  const pageTitles = await loadPageTitles(userId, 12);

  const inferred = inferBusinessProfile({
    domain,
    siteName: homepage?.siteName ?? null,
    homepageTitle: homepage?.title ?? null,
    homepageH1s: homepage?.h1s ?? [],
    homepageDescription: homepage?.description ?? null,
    topQueries: [
      ...topQueries,
      ...keywords.filter((k) => !k.removedAt).map((k) => k.query).slice(0, 30),
    ],
    pageTitles,
  });

  const next = {
    businessName: existing?.businessName?.trim() || inferred.businessName,
    primaryService: existing?.primaryService?.trim() || inferred.primaryService,
    secondaryServices:
      (existing?.secondaryServices?.length ?? 0) > 0
        ? existing!.secondaryServices
        : inferred.secondaryServices,
    targetCities:
      (existing?.targetCities?.length ?? 0) > 0
        ? existing!.targetCities
        : inferred.targetCities,
    targetCustomer: existing?.targetCustomer ?? null,
    averageCustomerValueEur: existing?.averageCustomerValueEur ?? null,
    competitorUrls: existing?.competitorUrls ?? [],
    biggestSeoProblem: existing?.biggestSeoProblem ?? null,
    preferredLanguage: existing?.preferredLanguage ?? inferred.preferredLanguage,
    weeklyEmailEnabled: existing?.weeklyEmailEnabled ?? true,
    weeklyEmailRecipient: existing?.weeklyEmailRecipient ?? null,
    emailDigestFrequency: existing?.emailDigestFrequency ?? "weekly",
    emailDigestSections: existing?.emailDigestSections ?? [
      "health_score",
      "top_issues",
      "position_changes",
      "brief_summary",
    ],
  };

  const filled: string[] = [];
  if (needsName && next.businessName) filled.push("businessName");
  if (needsService && next.primaryService) filled.push("primaryService");
  if (needsCities && next.targetCities.length > 0) filled.push("targetCities");
  if (filled.length === 0) return { filled };

  await t.upsertBusinessProfile(next);
  return { filled };
}

async function loadTopQueries(userId: string, limit: number): Promise<string[]> {
  try {
    const rows = await db
      .select({
        query: schema.keywords.query,
        impressions: sql<number>`coalesce(sum(${schema.gscMetrics.impressions}), 0)::int`,
      })
      .from(schema.keywords)
      .leftJoin(schema.gscMetrics, eq(schema.gscMetrics.keywordId, schema.keywords.id))
      .where(eq(schema.keywords.userId, userId))
      .groupBy(schema.keywords.query)
      .orderBy(desc(sql`coalesce(sum(${schema.gscMetrics.impressions}), 0)`))
      .limit(limit);
    return rows.map((r) => r.query).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadPageTitles(userId: string, limit: number): Promise<string[]> {
  try {
    const rows = await db
      .select({ title: schema.metaCrawlPages.title })
      .from(schema.metaCrawlPages)
      .where(eq(schema.metaCrawlPages.userId, userId))
      .limit(limit);
    return rows.map((r) => r.title).filter((t): t is string => Boolean(t));
  } catch {
    return [];
  }
}
