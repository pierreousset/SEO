import { describe, it, expect } from "vitest";
import {
  selectOpportunities,
  type GscMetricRow,
  type KeywordRef,
} from "@/lib/seo/prioritize";

// Helper: one GSC row. ctr/gscPosition already parsed to numbers (as the
// caller does with parseFloat before calling selectOpportunities).
function row(p: Partial<GscMetricRow> & { keywordId: string }): GscMetricRow {
  return {
    keywordId: p.keywordId,
    impressions: p.impressions ?? 0,
    clicks: p.clicks ?? 0,
    ctr: p.ctr ?? 0,
    gscPosition: p.gscPosition ?? 0,
  };
}

const kw: KeywordRef[] = [
  { id: "k1", query: "best running shoes" },
  { id: "k2", query: "trail shoes review" },
  { id: "k3", query: "marathon training plan" },
  { id: "k4", query: "cheap sneakers" },
];

describe("selectOpportunities", () => {
  it("returns up to 3, sorted by incremental clicks desc", () => {
    // All rank ~position 3 (benchmark CTR 0.11) but underperform on CTR.
    // Opportunity scales with impressions, so k1 > k2 > k3 > k4.
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k1", impressions: 10000, clicks: 100, gscPosition: 3 }), // ctr .01, gap .10 → 1000
      row({ keywordId: "k2", impressions: 5000, clicks: 50, gscPosition: 3 }), //  → 500
      row({ keywordId: "k3", impressions: 2000, clicks: 20, gscPosition: 3 }), //  → 200
      row({ keywordId: "k4", impressions: 1000, clicks: 10, gscPosition: 3 }), //  → 100
    ];
    const out = selectOpportunities(gsc, kw);
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.keywordId)).toEqual(["k1", "k2", "k3"]);
    expect(out[0].incrementalClicks).toBeGreaterThan(out[1].incrementalClicks);
    expect(out[0].query).toBe("best running shoes");
  });

  it("returns fewer than 3 without padding when few opportunities exist", () => {
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k1", impressions: 8000, clicks: 40, gscPosition: 4 }),
    ];
    const out = selectOpportunities(gsc, kw);
    expect(out).toHaveLength(1);
    expect(out[0].keywordId).toBe("k1");
  });

  it("returns [] for empty GSC metrics (cold-start site)", () => {
    expect(selectOpportunities([], kw)).toEqual([]);
  });

  it("does not crash on null/NaN/zero fields and treats them as no-opportunity", () => {
    const gsc: GscMetricRow[] = [
      // NaN impressions (unparsed column) → ignored
      row({ keywordId: "k1", impressions: NaN, clicks: NaN, gscPosition: NaN }),
      // zero impressions → ignored
      row({ keywordId: "k2", impressions: 0, clicks: 0, gscPosition: 5 }),
      // real opportunity survives
      row({ keywordId: "k3", impressions: 3000, clicks: 15, gscPosition: 5 }),
    ];
    const out = selectOpportunities(gsc, kw);
    expect(out.map((o) => o.keywordId)).toEqual(["k3"]);
  });

  it("excludes keywords already at or above benchmark CTR", () => {
    // Position 1 benchmark = 0.28. This keyword already gets 0.35 → no gap.
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k1", impressions: 10000, clicks: 3500, gscPosition: 1 }),
    ];
    expect(selectOpportunities(gsc, kw)).toEqual([]);
  });

  it("aggregates multiple days impression-weighted per keyword", () => {
    // Two days for k1: total 10000 impressions, 100 clicks, weighted pos = 3.
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k1", impressions: 6000, clicks: 60, gscPosition: 3 }),
      row({ keywordId: "k1", impressions: 4000, clicks: 40, gscPosition: 3 }),
    ];
    const out = selectOpportunities(gsc, kw);
    expect(out).toHaveLength(1);
    expect(out[0].impressions).toBe(10000);
    expect(out[0].clicks).toBe(100);
    expect(out[0].avgPosition).toBeCloseTo(3, 5);
  });

  it("tie-breaks deterministically: incrementalClicks → impressions → keywordId", () => {
    // k1 and k2 have identical incremental clicks and impressions; keywordId
    // ascending must decide, so k1 comes before k2 every run.
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k2", impressions: 5000, clicks: 50, gscPosition: 3 }),
      row({ keywordId: "k1", impressions: 5000, clicks: 50, gscPosition: 3 }),
    ];
    const out = selectOpportunities(gsc, kw);
    expect(out.map((o) => o.keywordId)).toEqual(["k1", "k2"]);
  });

  it("respects the limit argument", () => {
    const gsc: GscMetricRow[] = [
      row({ keywordId: "k1", impressions: 10000, clicks: 100, gscPosition: 3 }),
      row({ keywordId: "k2", impressions: 5000, clicks: 50, gscPosition: 3 }),
    ];
    expect(selectOpportunities(gsc, kw, 1)).toHaveLength(1);
    expect(selectOpportunities(gsc, kw, 0)).toEqual([]);
  });
});
