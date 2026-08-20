export type AdsTerm = {
  query: string;
  clicks: number;
  impressions: number;
  costMicros: number;
  conversions: number;
};

export type OrganicSnap = {
  query: string;
  position: number | null;
};

export type AdsOpportunity =
  | { kind: "paid_overlap"; query: string; costEur: number; position: number }
  | { kind: "paid_gap"; query: string; costEur: number }
  | { kind: "ads_new"; query: string; impressions: number; costEur: number };

function norm(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

export function microsToEur(micros: number): number {
  return Math.round((micros / 1_000_000) * 100) / 100;
}

/**
 * Cross Ads search terms with organic tracking.
 * Returns at most one opportunity per kind, highest cost first.
 */
export function selectAdsOpportunities(
  terms: AdsTerm[],
  organic: OrganicSnap[],
  opts?: {
    overlapMinEur?: number;
    gapMinEur?: number;
    newMinImpressions?: number;
  },
): AdsOpportunity[] {
  const overlapMin = opts?.overlapMinEur ?? 10;
  const gapMin = opts?.gapMinEur ?? 20;
  const newMinImp = opts?.newMinImpressions ?? 200;

  const org = new Map<string, number | null>();
  for (const o of organic) {
    const k = norm(o.query);
    if (!k) continue;
    if (!org.has(k)) org.set(k, o.position);
  }

  const byQuery = new Map<string, AdsTerm>();
  for (const t of terms) {
    const k = norm(t.query);
    if (!k) continue;
    const prev = byQuery.get(k);
    if (!prev) {
      byQuery.set(k, { ...t, query: k });
      continue;
    }
    byQuery.set(k, {
      query: k,
      clicks: prev.clicks + t.clicks,
      impressions: prev.impressions + t.impressions,
      costMicros: prev.costMicros + t.costMicros,
      conversions: prev.conversions + t.conversions,
    });
  }

  const ranked = [...byQuery.values()].sort((a, b) => b.costMicros - a.costMicros);

  let overlap: AdsOpportunity | null = null;
  let gap: AdsOpportunity | null = null;
  let adsNew: AdsOpportunity | null = null;

  for (const t of ranked) {
    const costEur = microsToEur(t.costMicros);
    const pos = org.get(t.query);

    if (!overlap && pos != null && pos > 0 && pos <= 3 && costEur >= overlapMin) {
      overlap = { kind: "paid_overlap", query: t.query, costEur, position: pos };
    } else if (!gap && (pos === undefined || pos === null) && costEur >= gapMin) {
      gap = { kind: "paid_gap", query: t.query, costEur };
    } else if (
      !adsNew &&
      pos === undefined &&
      t.impressions >= newMinImp &&
      costEur >= 5
    ) {
      adsNew = { kind: "ads_new", query: t.query, impressions: t.impressions, costEur };
    }

    if (overlap && gap && adsNew) break;
  }

  return [overlap, gap, adsNew].filter((x): x is AdsOpportunity => x != null);
}
