import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { fetchSearchVolume } from "@/lib/dataforseo";
import { keywordMarket } from "@/lib/seo/keyword-ideas";

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Fill Google Ads search volume on tracked keywords that have none,
 * or whose volume is older than 30 days. Fail-open: returns 0 on API errors.
 */
export async function fillMissingSearchVolumes(
  rows: Array<{
    id: string;
    query: string;
    searchVolume?: number | null;
    volumeUpdatedAt?: Date | null;
  }>,
  preferredLanguage?: string | null,
): Promise<number> {
  const now = Date.now();
  const need = rows.filter((r) => {
    if (r.searchVolume == null) return true;
    if (!r.volumeUpdatedAt) return true;
    return now - r.volumeUpdatedAt.getTime() > STALE_MS;
  });
  if (need.length === 0) return 0;
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return 0;

  try {
    const market = keywordMarket(preferredLanguage);
    const volumes = await fetchSearchVolume(
      need.map((r) => r.query),
      market,
    );
    const byKw = new Map(volumes.map((v) => [norm(v.keyword), v]));
    let updated = 0;
    await Promise.all(
      need.map(async (row) => {
        const hit = byKw.get(norm(row.query));
        if (!hit) return;
        await db
          .update(schema.keywords)
          .set({
            searchVolume: hit.searchVolume,
            cpc: hit.cpc,
            volumeUpdatedAt: new Date(),
          })
          .where(eq(schema.keywords.id, row.id));
        updated++;
      }),
    );
    return updated;
  } catch (err) {
    console.warn("[fillMissingSearchVolumes] failed:", err);
    return 0;
  }
}
