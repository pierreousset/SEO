import { describe, expect, it } from "vitest";
import { selectAdsOpportunities } from "@/lib/ads-opportunities";

const eur = (n: number) => Math.round(n * 1_000_000);

describe("selectAdsOpportunities", () => {
  it("flags paid queries already in organic top 3", () => {
    const out = selectAdsOpportunities(
      [{ query: "Audit SEO", clicks: 40, impressions: 800, costMicros: eur(80), conversions: 2 }],
      [{ query: "audit seo", position: 2 }],
    );
    expect(out).toEqual([
      { kind: "paid_overlap", query: "audit seo", costEur: 80, position: 2 },
    ]);
  });

  it("flags spend on queries with no organic tracking", () => {
    const out = selectAdsOpportunities(
      [{ query: "agence seo lyon", clicks: 20, impressions: 400, costMicros: eur(45), conversions: 0 }],
      [{ query: "autre chose", position: 4 }],
    );
    expect(out.some((o) => o.kind === "paid_gap" && o.query === "agence seo lyon")).toBe(true);
  });

  it("suggests tracking high-impression ads queries", () => {
    const out = selectAdsOpportunities(
      [{ query: "brief seo", clicks: 8, impressions: 900, costMicros: eur(12), conversions: 0 }],
      [],
    );
    expect(out.some((o) => o.kind === "ads_new" && o.query === "brief seo")).toBe(true);
  });

  it("ignores cheap overlap below the threshold", () => {
    const out = selectAdsOpportunities(
      [{ query: "marque", clicks: 2, impressions: 20, costMicros: eur(3), conversions: 0 }],
      [{ query: "marque", position: 1 }],
    );
    expect(out).toEqual([]);
  });

  it("aggregates duplicate query casing", () => {
    const out = selectAdsOpportunities(
      [
        { query: "SEO Lyon", clicks: 10, impressions: 100, costMicros: eur(20), conversions: 0 },
        { query: "seo lyon", clicks: 10, impressions: 100, costMicros: eur(20), conversions: 0 },
      ],
      [{ query: "seo lyon", position: 1 }],
    );
    expect(out[0]).toMatchObject({ kind: "paid_overlap", costEur: 40, position: 1 });
  });
});
